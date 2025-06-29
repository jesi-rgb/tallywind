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
import { eq, sql, sum, and, lt } from 'drizzle-orm';
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

// Analyze a GitHub repository using git clone (no API tokens needed)
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

		// If not, get repository info using git clone (no API needed)
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
					processing_started_at: null,
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
				processing_started_at: null,
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
					processing_started_at: null,
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

		// For existing repos that need re-analysis, use the same logic as above
		// This is a simplified version - you might want to implement full re-analysis
		const classCounts = await getClassCountsForRepo(repoRecord.id);
		return formatTailwindStats(repoRecord, classCounts);
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

// Clean up stale processing states (older than 10 minutes)
export async function cleanupStaleProcessingStates(): Promise<void> {
	if (!db) return;

	try {
		const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

		await db
			.update(repositories)
			.set({
				status: 'failed',
				processing_started_at: null
			})
			.where(
				and(
					eq(repositories.status, 'processing'),
					lt(repositories.processing_started_at, tenMinutesAgo)
				)
			);
	} catch (error) {
		console.error('Error cleaning up stale processing states:', error);
	}
}

// Try to acquire processing lock for a repository
export async function tryAcquireProcessingLock(
	repoUrl: string,
	forceReprocess: boolean = false
): Promise<Repository | null> {
	if (!db) return null;

	try {
		// First, clean up any stale processing states
		await cleanupStaleProcessingStates();

		// Check if repo exists and is not currently being processed
		const [existingRepo] = await db
			.select()
			.from(repositories)
			.where(eq(repositories.url, repoUrl));

		if (existingRepo) {
			console.log(`[${repoUrl}] Found existing repo with status: ${existingRepo.status}`);

			// If repo is completed and we're not forcing reprocess, don't acquire lock
			if (existingRepo.status === 'completed' && !forceReprocess) {
				console.log(`[${repoUrl}] Repository is completed, not acquiring lock`);
				return null;
			}
			// If repo exists and is currently processing, return null (can't acquire lock)
			if (existingRepo.status === 'processing') {
				console.log(`[${repoUrl}] Repository is currently processing, cannot acquire lock`);
				return null;
			}

			// Acquire lock for reprocessing (failed/ineligible repos or forced reprocess)
			console.log(
				`[${repoUrl}] Acquiring lock for reprocessing (status: ${existingRepo.status}, forced: ${forceReprocess})`
			);
			const [updatedRepo] = await db
				.update(repositories)
				.set({
					status: 'processing',
					processing_started_at: new Date()
				})
				.where(eq(repositories.id, existingRepo.id))
				.returning();

			return updatedRepo;
		}
		return null; // Repo doesn't exist yet
	} catch (error) {
		console.error('Error acquiring processing lock:', error);
		return null;
	}
}

// Release processing lock and update status
export async function releaseProcessingLock(repoId: number, finalStatus: string): Promise<void> {
	if (!db) return;

	try {
		await db
			.update(repositories)
			.set({
				status: finalStatus,
				processing_started_at: null,
				analyzed_at: new Date()
			})
			.where(eq(repositories.id, repoId));
	} catch (error) {
		console.error('Error releasing processing lock:', error);
	}
}

// Get class counts for a repository
export async function getClassCountsForRepo(repoId: number): Promise<Record<string, number>> {
	if (!db) return {};

	try {
		console.log(`[repo:${repoId}] Fetching class counts from database`);
		const startTime = Date.now();

		const counts = await db
			.select()
			.from(tailwindClasses)
			.where(eq(tailwindClasses.repo_id, repoId));

		console.log(
			`[repo:${repoId}] Retrieved ${counts.length} class records in ${Date.now() - startTime}ms`
		);

		const result: Record<string, number> = {};
		for (const row of counts) {
			result[row.class_name] = row.count;
		}

		return result;
	} catch (error) {
		console.error(`[repo:${repoId}] Error getting class counts:`, error);
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
	};
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
				name: result[0].name
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
		console.log(repoData);

		return {
			totalRepos: parseInt(repoData.repos_with_tailwind) || 0,
			totalClasses: parseInt(repoData.total_classes) || 0,
			uniqueClasses: parseInt(classData.unique_classes) || 0,
			totalFiles: parseInt(filesData.totalFiles) || 0
		};
	} catch (error) {
		console.error('Error getting global stats:', error);
		return {
			totalRepos: 0,
			totalClasses: 0,
			uniqueClasses: 0,
			totalFiles: 0
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

// SSE version that uses git clone (no API tokens needed)
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

	let repoRecord: Repository | null = null;

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

		console.log(`[${owner}/${repo}] Starting repository analysis`);

		// Emit initial progress
		emitter.emit({
			type: 'progress',
			data: { status: 'fetching', currentFile: 'Repository metadata' }
		});

		// First, check if repo exists and has valid cached data
		console.log(`[${owner}/${repo}] Checking for existing repository record`);
		const existingRepo = await getRepositoryByUrl(repoUrl);
		if (existingRepo && existingRepo.status === 'completed') {
			console.log(`[${owner}/${repo}] Found completed repository, checking cache validity`);
			// Check if cache is still valid (< 48 hours)
			const lastAnalyzed = new Date(existingRepo.analyzed_at);
			const now = new Date();
			const hoursSinceLastUpdate = (now.getTime() - lastAnalyzed.getTime()) / (1000 * 60 * 60);

			console.log(`[${owner}/${repo}] Cache age: ${hoursSinceLastUpdate.toFixed(1)} hours`);

			if (hoursSinceLastUpdate < 48) {
				// Return cached results immediately - no lock needed
				console.log(`[${owner}/${repo}] Using cached data, retrieving class counts`);
				const startTime = Date.now();
				const classCounts = await getClassCountsForRepo(existingRepo.id);
				console.log(`[${owner}/${repo}] Class counts retrieved in ${Date.now() - startTime}ms`);

				const stats = formatTailwindStats(existingRepo, classCounts);

				console.log(`[${owner}/${repo}] Returning cached results (${stats.total} total classes)`);
				emitter.emit({
					type: 'completed',
					data: {
						repo: existingRepo,
						totalClasses: stats.total,
						topClasses: stats.topClasses,
						classCounts: stats.classCounts
					}
				});
				emitter.close();
				return;
			} else {
				console.log(`[${owner}/${repo}] Cache expired, will reprocess`);
			}
		}
		// Check if repo is currently being processed by another request
		if (existingRepo && existingRepo.status === 'processing') {
			console.log(`[${owner}/${repo}] Repository is currently being processed by another request`);
			emitter.emit({
				type: 'error',
				data: { message: 'Repository is currently being processed by another request' }
			});
			emitter.close();
			return;
		}
		// Only try to acquire lock if no valid cache exists
		console.log(`[${owner}/${repo}] No valid cache found, attempting to acquire processing lock`);
		const needsReprocessing = existingRepo?.status === 'completed' || false;
		repoRecord = await tryAcquireProcessingLock(repoUrl, needsReprocessing);
		if (!repoRecord) {
			console.log(`[${owner}/${repo}] Could not acquire lock, starting fresh repository analysis`);
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

			const eligibility = repoAnalysis.eligibility;

			if (!eligibility.isEligible) {
				// Create repository record with eligibility info but don't analyze
				const newRepo: NewRepository = {
					url: repoUrl,
					owner,
					name: repo,
					default_branch: repoAnalysis.defaultBranch,
					analyzed_at: new Date(),
					processing_started_at: null,
					status: 'ineligible',
					is_eligible: false,
					has_tailwind: eligibility.hasTailwind,
					has_package_json: eligibility.packageJsonExists,
					eligibility_reason: eligibility.reason
				};

				await db.insert(repositories).values(newRepo).returning();
				await repoAnalysis.cleanup();
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
				default_branch: repoAnalysis.defaultBranch,
				analyzed_at: new Date(),
				processing_started_at: new Date(),
				status: 'processing',
				is_eligible: true,
				has_tailwind: eligibility.hasTailwind,
				has_package_json: eligibility.packageJsonExists
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
					processing_started_at: null,
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
					repo: updatedRepo,
					totalClasses: stats.total,
					topClasses: stats.topClasses,
					classCounts: stats.classCounts
				}
			});

			emitter.close();
		} else {
			// We successfully acquired lock for reprocessing existing repo
			console.log(
				`[${owner}/${repo}] Successfully acquired lock for reprocessing existing repository`
			);

			emitter.emit({
				type: 'progress',
				data: { status: 'fetching', currentFile: 'Cloning repository for reprocessing' }
			});

			const repoAnalysis = await gitClone.analyzeRepositoryLocal(owner, repo);

			if (!repoAnalysis) {
				console.error('Could not clone repository for reprocessing:', repoUrl);
				emitter.emit({
					type: 'error',
					data: { message: 'Could not clone repository for reprocessing' }
				});
				emitter.close();
				return;
			}

			const eligibility = repoAnalysis.eligibility;

			if (!eligibility.isEligible) {
				// Update existing repository record with new eligibility info
				await db
					.update(repositories)
					.set({
						status: 'ineligible',
						processing_started_at: null,
						analyzed_at: new Date(),
						is_eligible: false,
						has_tailwind: eligibility.hasTailwind,
						has_package_json: eligibility.packageJsonExists,
						eligibility_reason: eligibility.reason
					})
					.where(eq(repositories.id, repoRecord.id));

				await repoAnalysis.cleanup();
				emitter.emit({
					type: 'error',
					data: { message: eligibility.reason || 'Repository is not eligible for analysis' }
				});
				emitter.close();
				return;
			}

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

			// Update repo status to completed and release lock
			await db
				.update(repositories)
				.set({
					status: 'completed',
					analyzed_at: new Date(),
					processing_started_at: null,
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

			console.log(`[${owner}/${repo}] Reprocessing completed (${stats.total} total classes)`);

			// Emit completion event
			emitter.emit({
				type: 'completed',
				data: {
					repo: updatedRepo,
					totalClasses: stats.total,
					topClasses: stats.topClasses,
					classCounts: stats.classCounts
				}
			});

			emitter.close();
		}
	} catch (error) {
		console.error(`[${repoUrl}] Error analyzing repository:`, error);

		// Release processing lock on error
		if (repoRecord?.id) {
			console.log(`[${repoUrl}] Releasing processing lock due to error`);
			await releaseProcessingLock(repoRecord.id, 'failed');
		}

		emitter.emit({
			type: 'error',
			data: { message: `Error analyzing repository: ${error}` }
		});
		emitter.close();
	}
}
