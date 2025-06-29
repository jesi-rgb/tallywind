import { db } from '$lib/db';
import {
	repositories,
	tailwindClasses,
	type Repository,
	type NewRepository,
	type NewTailwindClass
} from '$lib/db/schema';
import * as github from '$lib/github';
import * as gitClone from '$lib/git-clone';
import { countTailwindClasses, shouldParseFile } from '$lib/tailwind-parser';
import { eq, sql, sum } from 'drizzle-orm';
import { SSEEmitter } from '$lib/sse';

export type TailwindStats = {
	repo: Repository;
	classCounts: Record<string, number>;
	total: number;
	topClasses: Array<{ className: string; count: number }>;
	lastUpdated: Date;
	progress?: {
		status: 'fetching' | 'parsing' | 'analyzing' | 'saving' | 'completed';
		filesProcessed?: number;
		totalFiles?: number;
		currentFile?: string;
	};
};

// Analyze a GitHub repository using git clone approach (much faster, no rate limits)
export async function analyzeRepositoryWithGitClone(
	repoUrl: string
): Promise<TailwindStats | null> {
	if (!db) {
		console.error('Database is not available');
		return null;
	}

	try {
		// Parse GitHub URL
		const repoInfo = github.parseGitHubUrl(repoUrl);
		if (!repoInfo) {
			console.error('Invalid GitHub URL:', repoUrl);
			return null;
		}

		const { owner, repo } = repoInfo;

		// Check if we've already analyzed this repo
		let repoRecord = await getRepositoryByUrl(repoUrl);
		let isExisting = !!repoRecord;

		// If this is an existing repo, check if we need to update or return cached data
		if (repoRecord && isExisting && repoRecord.status === 'completed') {
			// If it was analyzed recently (e.g., within the last 24 hours), return cached results
			const lastAnalyzed = new Date(repoRecord.analyzed_at);
			const now = new Date();
			const hoursSinceLastUpdate = (now.getTime() - lastAnalyzed.getTime()) / (1000 * 60 * 60);

			if (hoursSinceLastUpdate < 24) {
				// Return cached results
				const classCounts = await getClassCountsForRepo(repoRecord.id);
				return formatTailwindStats(repoRecord, classCounts);
			}
		}

		// Get repository info using git clone (no API needed)
		if (!repoRecord) {
			// Clone repository locally and check eligibility (auto-detects default branch)
			const repoAnalysis = await gitClone.analyzeRepositoryLocal(owner, repo);

			if (!repoAnalysis) {
				console.error('Could not clone repository:', repoUrl);
				return null;
			}

			if (!repoAnalysis.eligibility.isEligible) {
				// Create repository record with eligibility info but don't analyze
				const newRepo: NewRepository = {
					url: repoUrl,
					owner,
					name: repo,
					default_branch: repoAnalysis.defaultBranch,
					analyzed_at: new Date(),
					status: 'ineligible',
					is_eligible: false,
					has_tailwind: repoAnalysis.eligibility.hasTailwind,
					has_package_json: repoAnalysis.eligibility.packageJsonExists,
					eligibility_reason: repoAnalysis.eligibility.reason
				};

				await db.insert(repositories).values(newRepo).returning();
				await repoAnalysis.cleanup();
				return null;
			}

			// Create new repository record
			const newRepo: NewRepository = {
				url: repoUrl,
				owner,
				name: repo,
				default_branch: repoAnalysis.defaultBranch,
				analyzed_at: new Date(),
				status: 'processing',
				is_eligible: true,
				has_tailwind: repoAnalysis.eligibility.hasTailwind,
				has_package_json: repoAnalysis.eligibility.packageJsonExists
			};

			// Insert into database
			const [insertedRepo] = await db.insert(repositories).values(newRepo).returning();
			repoRecord = insertedRepo;

			// Filter files that are eligible for Tailwind analysis
			const eligibleFiles = repoAnalysis.files.filter((file) => shouldParseFile(file.path));

			// Update database with file counts
			await db
				.update(repositories)
				.set({
					total_files: eligibleFiles.length,
					processed_files: 0
				})
				.where(eq(repositories.id, repoRecord.id));

			// Process files to find Tailwind classes
			const filesToProcess = [];
			let filesProcessed = 0;

			for (const file of eligibleFiles) {
				const content = await repoAnalysis.getFileContent(file.path);
				if (content) {
					filesToProcess.push({
						name: file.path,
						content
					});
				}

				filesProcessed++;

				// Update database progress
				await db
					.update(repositories)
					.set({ processed_files: filesProcessed })
					.where(eq(repositories.id, repoRecord.id));
			}

			// Count Tailwind classes
			const classCounts = countTailwindClasses(filesToProcess);

			// Delete any existing class counts for this repo
			await db.delete(tailwindClasses).where(eq(tailwindClasses.repo_id, repoRecord.id));

			// Insert new class counts
			const classRows: NewTailwindClass[] = Object.entries(classCounts).map(
				([class_name, count]) => ({
					repo_id: repoRecord!.id,
					class_name,
					count
				})
			);

			// Batch insert class counts
			if (classRows.length > 0) {
				// Insert in batches to avoid too many parameters error
				const BATCH_SIZE = 100;
				for (let i = 0; i < classRows.length; i += BATCH_SIZE) {
					const batch = classRows.slice(i, i + BATCH_SIZE);
					await db.insert(tailwindClasses).values(batch);
				}
			}

			// Calculate total classes
			const totalClasses = Object.values(classCounts).reduce((sum, count) => sum + count, 0);

			// Update repo status to completed
			await db
				.update(repositories)
				.set({
					status: 'completed',
					analyzed_at: new Date(),
					total_classes: totalClasses
				})
				.where(eq(repositories.id, repoRecord.id));

			// Cleanup temporary directory
			await repoAnalysis.cleanup();

			// Get updated repo record
			const [updatedRepo] = await db
				.select()
				.from(repositories)
				.where(eq(repositories.id, repoRecord.id));

			return formatTailwindStats(updatedRepo, classCounts);
		}

		// For existing repos that need re-analysis
		const classCounts = await getClassCountsForRepo(repoRecord.id);
		return formatTailwindStats(repoRecord, classCounts);
	} catch (error) {
		console.error('Error analyzing repository:', error);
		return null;
	}
}

// SSE version with git clone approach
export async function analyzeRepositoryWithSSEAndGitClone(
	repoUrl: string,
	emitter: SSEEmitter
): Promise<void> {
	if (!db) {
		console.error('Database is not available');
		emitter.emit({ type: 'error', data: { message: 'Database is not available' } });
		emitter.close();
		return;
	}

	try {
		// Parse GitHub URL
		const repoInfo = github.parseGitHubUrl(repoUrl);
		if (!repoInfo) {
			console.error('Invalid GitHub URL:', repoUrl);
			emitter.emit({ type: 'error', data: { message: 'Invalid GitHub URL' } });
			emitter.close();
			return;
		}

		const { owner, repo } = repoInfo;

		// Emit initial progress
		emitter.emit({
			type: 'progress',
			data: { status: 'fetching', currentFile: 'Repository metadata' }
		});

		// Check if we've already analyzed this repo
		let repoRecord = await getRepositoryByUrl(repoUrl);
		let isExisting = !!repoRecord;

		// If this is an existing repo, check if we need to update or return cached data
		if (repoRecord && isExisting && repoRecord.status === 'completed') {
			// If it was analyzed recently (e.g., within the last 48 hours), return cached results
			const lastAnalyzed = new Date(repoRecord.analyzed_at);
			const now = new Date();
			const hoursSinceLastUpdate = (now.getTime() - lastAnalyzed.getTime()) / (1000 * 60 * 60);

			if (hoursSinceLastUpdate < 48) {
				// Return cached results
				const classCounts = await getClassCountsForRepo(repoRecord.id);
				const stats = formatTailwindStats(repoRecord, classCounts);

				emitter.emit({
					type: 'completed',
					data: {
						repo: repoRecord,
						totalClasses: stats.total,
						topClasses: stats.topClasses,
						classCounts: stats.classCounts
					}
				});
				emitter.close();
				return;
			}
		}

		// Get repository info using git clone (no API needed)
		if (!repoRecord) {
			// Clone repository locally and check eligibility
			emitter.emit({
				type: 'progress',
				data: { status: 'fetching', currentFile: 'Cloning repository' }
			});

			const repoAnalysis = await gitClone.analyzeRepositoryLocal(owner, repo);

			if (!repoAnalysis) {
				console.error('Could not clone repository:', repoUrl);
				emitter.emit({
					type: 'error',
					data: { message: 'Could not clone repository' }
				});
				emitter.close();
				return;
			}

			if (!repoAnalysis.eligibility.isEligible) {
				// Create repository record with eligibility info but don't analyze
				const newRepo: NewRepository = {
					url: repoUrl,
					owner,
					name: repo,
					default_branch: repoAnalysis.defaultBranch,
					analyzed_at: new Date(),
					status: 'ineligible',
					is_eligible: false,
					has_tailwind: repoAnalysis.eligibility.hasTailwind,
					has_package_json: repoAnalysis.eligibility.packageJsonExists,
					eligibility_reason: repoAnalysis.eligibility.reason
				};

				await db.insert(repositories).values(newRepo).returning();
				await repoAnalysis.cleanup();
				emitter.emit({
					type: 'error',
					data: {
						message: repoAnalysis.eligibility.reason || 'Repository is not eligible for analysis'
					}
				});
				emitter.close();
				return;
			}

			// Create new repository record
			const newRepo: NewRepository = {
				url: repoUrl,
				owner,
				name: repo,
				default_branch: repoAnalysis.defaultBranch,
				analyzed_at: new Date(),
				status: 'processing',
				is_eligible: true,
				has_tailwind: repoAnalysis.eligibility.hasTailwind,
				has_package_json: repoAnalysis.eligibility.packageJsonExists
			};

			// Insert into database
			const [insertedRepo] = await db.insert(repositories).values(newRepo).returning();
			repoRecord = insertedRepo;

			// Filter files that are eligible for Tailwind analysis
			const eligibleFiles = repoAnalysis.files.filter((file) => shouldParseFile(file.path));

			// Update database with file counts
			await db
				.update(repositories)
				.set({
					total_files: eligibleFiles.length,
					processed_files: 0
				})
				.where(eq(repositories.id, repoRecord.id));

			emitter.emit({
				type: 'progress',
				data: {
					status: 'parsing',
					totalFiles: eligibleFiles.length,
					filesProcessed: 0,
					repoId: repoRecord.id
				}
			});

			// Process files to find Tailwind classes
			const filesToProcess = [];
			let filesProcessed = 0;

			for (const file of eligibleFiles) {
				emitter.emit({
					type: 'progress',
					data: {
						status: 'parsing',
						currentFile: file.path,
						filesProcessed,
						totalFiles: eligibleFiles.length,
						repoId: repoRecord.id
					}
				});

				const content = await repoAnalysis.getFileContent(file.path);
				if (content) {
					filesToProcess.push({
						name: file.path,
						content
					});
				}

				filesProcessed++;

				// Update database progress
				await db
					.update(repositories)
					.set({ processed_files: filesProcessed })
					.where(eq(repositories.id, repoRecord.id));

				// Emit file processed event
				emitter.emit({
					type: 'file-processed',
					data: {
						filePath: file.path,
						classesFound: 0, // We'll update this after counting
						filesProcessed,
						totalFiles: eligibleFiles.length
					}
				});
			}

			// Count Tailwind classes
			emitter.emit({
				type: 'progress',
				data: {
					status: 'analyzing',
					currentFile: 'Counting Tailwind classes',
					repoId: repoRecord.id
				}
			});

			const classCounts = countTailwindClasses(filesToProcess);

			// Delete any existing class counts for this repo
			emitter.emit({
				type: 'progress',
				data: {
					status: 'saving',
					currentFile: 'Saving to database',
					repoId: repoRecord.id
				}
			});

			await db.delete(tailwindClasses).where(eq(tailwindClasses.repo_id, repoRecord.id));

			// Insert new class counts
			const classRows: NewTailwindClass[] = Object.entries(classCounts).map(
				([class_name, count]) => ({
					repo_id: repoRecord!.id,
					class_name,
					count
				})
			);

			// Batch insert class counts
			if (classRows.length > 0) {
				// Insert in batches to avoid too many parameters error
				const BATCH_SIZE = 100;
				for (let i = 0; i < classRows.length; i += BATCH_SIZE) {
					const batch = classRows.slice(i, i + BATCH_SIZE);
					await db.insert(tailwindClasses).values(batch);

					emitter.emit({
						type: 'progress',
						data: {
							status: 'saving',
							currentFile: `Saving batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(classRows.length / BATCH_SIZE)}`,
							repoId: repoRecord.id
						}
					});
				}
			}

			// Calculate total classes
			const totalClasses = Object.values(classCounts).reduce((sum, count) => sum + count, 0);

			// Update repo status to completed
			await db
				.update(repositories)
				.set({
					status: 'completed',
					analyzed_at: new Date(),
					total_classes: totalClasses
				})
				.where(eq(repositories.id, repoRecord.id));

			// Cleanup temporary directory
			await repoAnalysis.cleanup();

			// Get updated repo record
			const [updatedRepo] = await db
				.select()
				.from(repositories)
				.where(eq(repositories.id, repoRecord.id));

			const stats = formatTailwindStats(updatedRepo, classCounts);

			// Emit completion event
			emitter.emit({
				type: 'completed',
				data: {
					repo: repoRecord,
					totalClasses: stats.total,
					topClasses: stats.topClasses,
					classCounts: stats.classCounts
				}
			});

			emitter.close();
		}
	} catch (error) {
		console.error('Error analyzing repository:', error);
		emitter.emit({
			type: 'error',
			data: { message: `Error analyzing repository: ${error}` }
		});
		emitter.close();
	}
}

// Get repository by URL
export async function getRepositoryByUrl(url: string): Promise<Repository | null> {
	if (!db) return null;

	try {
		const [repo] = await db.select().from(repositories).where(eq(repositories.url, url));

		return repo || null;
	} catch (error) {
		console.error('Error getting repository by URL:', error);
		return null;
	}
}

// Get class counts for a repository
export async function getClassCountsForRepo(repoId: number): Promise<Record<string, number>> {
	if (!db) return {};

	try {
		const counts = await db
			.select()
			.from(tailwindClasses)
			.where(eq(tailwindClasses.repo_id, repoId));

		const result: Record<string, number> = {};
		for (const row of counts) {
			result[row.class_name] = row.count;
		}

		return result;
	} catch (error) {
		console.error('Error getting class counts for repo:', error);
		return {};
	}
}

// Format Tailwind stats for response
function formatTailwindStats(repo: Repository, classCounts: Record<string, number>): TailwindStats {
	// Calculate total
	const total = Object.values(classCounts).reduce((sum, count) => sum + count, 0);

	// Get top 20 classes
	const topClasses = Object.entries(classCounts)
		.map(([className, count]) => ({ className, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 20);

	return {
		repo,
		classCounts,
		total,
		topClasses,
		lastUpdated: new Date(repo.analyzed_at)
	};
}
