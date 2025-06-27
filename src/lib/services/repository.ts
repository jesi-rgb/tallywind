import { db } from '$lib/db';
import {
	repositories,
	tailwindClasses,
	type Repository,
	type NewRepository,
	type NewTailwindClass
} from '$lib/db/schema';
import * as github from '$lib/github';
import { countTailwindClasses, shouldParseFile } from '$lib/tailwind-parser';
import { count, eq, sql, sum } from 'drizzle-orm';
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

// Analyze a GitHub repository and save the results to the database
export async function analyzeRepository(repoUrl: string): Promise<TailwindStats | null> {
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

		// If not, get repository info from GitHub and insert it
		if (!repoRecord) {
			const githubRepo = await github.getRepository(owner, repo);
			if (!githubRepo) {
				console.error('Could not fetch repository from GitHub:', repoUrl);
				return null;
			}

			// Check repository eligibility
			const eligibility = await github.checkRepositoryEligibility(
				owner,
				repo,
				githubRepo.default_branch
			);

			if (!eligibility.isEligible) {
				// Create repository record with eligibility info but don't analyze
				const newRepo: NewRepository = {
					url: repoUrl,
					owner,
					name: repo,
					default_branch: githubRepo.default_branch,
					analyzed_at: new Date(),
					status: 'ineligible',
					is_eligible: false,
					has_tailwind: eligibility.hasTailwind,
					has_package_json: eligibility.packageJsonExists,
					eligibility_reason: eligibility.reason
				};

				await db.insert(repositories).values(newRepo).returning();
				return null;
			}

			// Create new repository record
			const newRepo: NewRepository = {
				url: repoUrl,
				owner,
				name: repo,
				default_branch: githubRepo.default_branch,
				analyzed_at: new Date(),
				status: 'processing',
				is_eligible: true,
				has_tailwind: eligibility.hasTailwind,
				has_package_json: eligibility.packageJsonExists
			};

			// Insert into database
			const [insertedRepo] = await db.insert(repositories).values(newRepo).returning();
			repoRecord = insertedRepo;
		}

		if (!repoRecord) {
			console.error('Failed to create or retrieve repository record');
			return null;
		}

		// If this is an existing repo, check if we need to update or return cached data
		if (isExisting && repoRecord.status === 'completed') {
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

		// Update repo status to processing
		await db
			.update(repositories)
			.set({ status: 'processing', analyzed_at: new Date() })
			.where(eq(repositories.id, repoRecord.id));

		// Get files from GitHub
		const defaultBranch = repoRecord.default_branch || 'main';
		const files = await github.getAllFiles(owner, repo, defaultBranch);

		// Filter files that are eligible for Tailwind analysis
		const eligibleFiles = files.filter((file) => shouldParseFile(file.path));

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
			const content = await github.getFileContent(file.url);
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
				repo_id: repoRecord.id,
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

		// Get updated repo record
		const [updatedRepo] = await db
			.select()
			.from(repositories)
			.where(eq(repositories.id, repoRecord.id));

		return formatTailwindStats(updatedRepo, classCounts);
	} catch (error) {
		console.error('Error analyzing repository:', error);
		return null;
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

// Get global top Tailwind classes
export async function getGlobalTopClasses(
	limit: number = 50
): Promise<Array<{ className: string; count: number }>> {
	if (!db) return [];

	try {
		const result = await db.execute(sql`
			SELECT 
				class_name as className, 
				SUM(count) as count 
			FROM tailwind_classes 
			GROUP BY class_name 
			ORDER BY SUM(count) DESC 
			LIMIT ${limit}
		`);

		return result as unknown as Array<{ className: string; count: number }>;
	} catch (error) {
		console.error('Error getting global top classes:', error);
		return [];
	}
}

// Get the longest Tailwind class name
export async function getLongestClassName(): Promise<{
	className: string;
	length: number;
	repo: {
		owner: string;
		name: string;
	}
} | null> {
	if (!db) return null;

	try {
		const result = await db
			.select({
				classname: tailwindClasses.class_name,
				repo_id: tailwindClasses.repo_id,
				length: sql<number>`LENGTH(${tailwindClasses.class_name})`.as('length'),
				owner: repositories.owner,
				name: repositories.name
			})
			.from(tailwindClasses)
			.innerJoin(repositories, eq(tailwindClasses.repo_id, repositories.id))
			.orderBy(sql`LENGTH(${tailwindClasses.class_name}) DESC`)
			.limit(1);


		const data = result[0] as any;
		if (!data) return null;

		return {
			className: data.classname,
			length: parseInt(data.length),
			repo: {
				owner: result[0].owner,
				name: result[0].name,
			}
		};
	} catch (error) {
		console.error('Error getting longest class name:', error);
		return null;
	}
}

// Get global statistics
export async function getGlobalStats(): Promise<{
	totalRepos: number;
	totalClasses: number;
	uniqueClasses: number;
	totalFiles: number;
}> {
	if (!db)
		return {
			totalRepos: 0,
			totalClasses: 0,
			uniqueClasses: 0,
			totalFiles: 0
		};

	try {
		const [repoStats, classStats, filesStats] = await Promise.all([
			db.execute(sql`
				SELECT 
					COUNT(*) as total_repos,
					COUNT(CASE WHEN is_eligible = true THEN 1 END) as eligible_repos,
					COUNT(CASE WHEN has_tailwind = true THEN 1 END) as repos_with_tailwind,
					SUM(total_classes) as total_classes
				FROM repositories
			`),
			db.execute(sql`
				SELECT 
					COUNT(DISTINCT class_name) as unique_classes
				FROM tailwind_classes
			`),
			db.select({ totalFiles: sum(repositories.total_files) }).from(repositories)
		]);

		const repoData = repoStats[0] as any;
		const classData = classStats[0] as any;
		const filesData = filesStats[0] as any;
		console.log(repoData)

		return {
			totalRepos: parseInt(repoData.repos_with_tailwind) || 0,
			totalClasses: parseInt(repoData.total_classes) || 0,
			uniqueClasses: parseInt(classData.unique_classes) || 0,
			totalFiles: parseInt(filesData.totalFiles) || 0,
		};
	} catch (error) {
		console.error('Error getting global stats:', error);
		return {
			totalRepos: 0,
			totalClasses: 0,
			uniqueClasses: 0,
			eligibleRepos: 0,
			reposWithTailwind: 0
		};
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

// SSE version of analyzeRepository that emits progress events
export async function analyzeRepositoryWithSSE(
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

		// If not, get repository info from GitHub and insert it
		if (!repoRecord) {
			const githubRepo = await github.getRepository(owner, repo);
			if (!githubRepo) {
				console.error('Could not fetch repository from GitHub:', repoUrl);
				emitter.emit({
					type: 'error',
					data: { message: 'Could not fetch repository from GitHub' }
				});
				emitter.close();
				return;
			}

			// Check repository eligibility
			emitter.emit({
				type: 'progress',
				data: { status: 'fetching', currentFile: 'Checking eligibility' }
			});

			const eligibility = await github.checkRepositoryEligibility(
				owner,
				repo,
				githubRepo.default_branch
			);

			if (!eligibility.isEligible) {
				// Create repository record with eligibility info but don't analyze
				const newRepo: NewRepository = {
					url: repoUrl,
					owner,
					name: repo,
					default_branch: githubRepo.default_branch,
					analyzed_at: new Date(),
					status: 'ineligible',
					is_eligible: false,
					has_tailwind: eligibility.hasTailwind,
					has_package_json: eligibility.packageJsonExists,
					eligibility_reason: eligibility.reason
				};

				await db.insert(repositories).values(newRepo).returning();
				emitter.emit({
					type: 'error',
					data: { message: eligibility.reason || 'Repository is not eligible for analysis' }
				});
				emitter.close();
				return;
			}

			// Create new repository record
			const newRepo: NewRepository = {
				url: repoUrl,
				owner,
				name: repo,
				default_branch: githubRepo.default_branch,
				analyzed_at: new Date(),
				status: 'processing',
				is_eligible: true,
				has_tailwind: eligibility.hasTailwind,
				has_package_json: eligibility.packageJsonExists
			};

			// Insert into database
			const [insertedRepo] = await db.insert(repositories).values(newRepo).returning();
			repoRecord = insertedRepo;
		}

		if (!repoRecord) {
			console.error('Failed to create or retrieve repository record');
			emitter.emit({
				type: 'error',
				data: { message: 'Failed to create or retrieve repository record' }
			});
			emitter.close();
			return;
		}

		// If this is an existing repo, check if we need to update or return cached data
		if (isExisting && repoRecord.status === 'completed') {
			// If it was analyzed recently (e.g., within the last 24 hours), return cached results
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
						repoId: repoRecord.id,
						repoOwner: repoRecord.owner,
						repoName: repoRecord.name,
						totalClasses: stats.total,
						topClasses: stats.topClasses,
						classCounts: stats.classCounts
					}
				});
				emitter.close();
				return;
			}
		}

		// Update repo status to processing
		await db
			.update(repositories)
			.set({ status: 'processing', analyzed_at: new Date() })
			.where(eq(repositories.id, repoRecord.id));

		// Get files from GitHub
		emitter.emit({
			type: 'progress',
			data: { status: 'fetching', currentFile: 'File list', repoId: repoRecord.id }
		});

		const defaultBranch = repoRecord.default_branch || 'main';
		const files = await github.getAllFiles(owner, repo, defaultBranch);

		// Filter files that are eligible for Tailwind analysis
		const eligibleFiles = files.filter((file) => shouldParseFile(file.path));

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

			const content = await github.getFileContent(file.url);
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
				repo_id: repoRecord.id,
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
				repoId: repoRecord.id,
				totalClasses: stats.total,
				topClasses: stats.topClasses,
				classCounts: stats.classCounts
			}
		});

		emitter.close();
	} catch (error) {
		console.error('Error analyzing repository:', error);
		emitter.emit({
			type: 'error',
			data: { message: `Error analyzing repository: ${error}` }
		});
		emitter.close();
	}
}
