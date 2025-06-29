import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile, stat, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

// Timeout wrapper for promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
		)
	]);
}

// Define types
type GitHubFile = {
	name: string;
	path: string;
	sha: string;
	type: 'file' | 'dir';
	url: string;
	download_url: string | null;
};

type LocalRepoInfo = {
	localPath: string;
	cleanup: () => Promise<void>;
};

// Get the default branch of a repository without cloning
export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
	try {
		const repoUrl = `https://github.com/${owner}/${repo}.git`;

		// Use git ls-remote to get the default branch without cloning (30s timeout)
		const { stdout } = await withTimeout(
			execAsync(`git ls-remote --symref ${repoUrl} HEAD`),
			30000,
			'git ls-remote --symref'
		);

		// Parse the output to find the default branch
		// Output format: "ref: refs/heads/main\tHEAD"
		const match = stdout.match(/ref: refs\/heads\/([^\s]+)/);
		if (match) {
			return match[1];
		}

		// Fallback: try common default branch names
		const commonBranches = ['main', 'master', 'develop'];
		for (const branch of commonBranches) {
			try {
				const { stdout: branchCheck } = await withTimeout(
					execAsync(`git ls-remote --heads ${repoUrl} ${branch}`),
					15000,
					`git ls-remote --heads ${branch}`
				);
				if (branchCheck.trim()) {
					return branch;
				}
			} catch {
				// Continue to next branch
			}
		}

		// Final fallback
		return 'main';
	} catch (error) {
		console.error('Error getting default branch:', error);
		return 'main';
	}
}

// Clone repository locally using shallow clone for efficiency
export async function cloneRepository(
	owner: string,
	repo: string,
	branch?: string
): Promise<LocalRepoInfo | null> {
	try {
		// Create unique temporary directory
		const tempDir = join(tmpdir(), `tallywind-${owner}-${repo}-${Date.now()}`);
		const repoUrl = `https://github.com/${owner}/${repo}.git`;

		// Get default branch if not specified
		const targetBranch = branch || (await getDefaultBranch(owner, repo));

		// Clone with optimizations for speed and efficiency (2 minute timeout)
		const cloneCommand = [
			'git clone',
			'--single-branch',
			'--depth=1',
			`--branch=${targetBranch}`,
			repoUrl,
			tempDir
		].join(' ');

		console.log(`Cloning repository: ${owner}/${repo} (branch: ${targetBranch})`);
		await withTimeout(execAsync(cloneCommand), 120000, 'git clone');

		return {
			localPath: tempDir,
			cleanup: async () => {
				try {
					await rm(tempDir, { recursive: true, force: true });
				} catch (error) {
					console.error('Error cleaning up temporary directory:', error);
				}
			}
		};
	} catch (error) {
		console.error('Error cloning repository:', error);
		return null;
	}
}

// Get all files from local repository
export async function getAllFilesLocal(localPath: string): Promise<GitHubFile[]> {
	const files: GitHubFile[] = [];

	async function walkDirectory(dirPath: string, relativePath: string = ''): Promise<void> {
		try {
			const entries = await readdir(dirPath);

			for (const entry of entries) {
				// Skip .git directory and other hidden directories
				if (entry.startsWith('.')) continue;

				const fullPath = join(dirPath, entry);
				const relativeFilePath = relativePath ? join(relativePath, entry) : entry;
				const stats = await stat(fullPath);

				if (stats.isDirectory()) {
					await walkDirectory(fullPath, relativeFilePath);
				} else if (stats.isFile()) {
					files.push({
						name: entry,
						path: relativeFilePath.replace(/\\/g, '/'), // Normalize path separators
						sha: '', // Not available locally, but not needed for our use case
						type: 'file',
						url: '', // Not applicable for local files
						download_url: null
					});
				}
			}
		} catch (error) {
			console.error(`Error walking directory ${dirPath}:`, error);
		}
	}

	await walkDirectory(localPath);
	return files;
}

// Get file content from local repository
export async function getFileContentLocal(
	localPath: string,
	filePath: string
): Promise<string | null> {
	try {
		const fullPath = join(localPath, filePath);
		const content = await readFile(fullPath, 'utf-8');
		return content;
	} catch (error) {
		console.error(`Error reading file ${filePath}:`, error);
		return null;
	}
}

// Check repository eligibility using local clone
export async function checkRepositoryEligibilityLocal(localPath: string): Promise<{
	isEligible: boolean;
	hasTailwind: boolean;
	packageJsonExists: boolean;
	reason?: string;
}> {
	try {
		const packageJsonPath = join(localPath, 'package.json');

		try {
			const packageContent = await readFile(packageJsonPath, 'utf-8');
			const packageJson = JSON.parse(packageContent);

			// Check for Tailwind CSS in dependencies or devDependencies
			const dependencies = packageJson.dependencies || {};
			const devDependencies = packageJson.devDependencies || {};

			const hasTailwind =
				'tailwindcss' in dependencies ||
				'tailwindcss' in devDependencies ||
				'@tailwindcss/cli' in dependencies ||
				'@tailwindcss/cli' in devDependencies;

			if (!hasTailwind) {
				return {
					isEligible: false,
					hasTailwind: false,
					packageJsonExists: true,
					reason: 'No Tailwind CSS found in dependencies'
				};
			}

			return {
				isEligible: true,
				hasTailwind: true,
				packageJsonExists: true
			};
		} catch (error) {
			return {
				isEligible: false,
				hasTailwind: false,
				packageJsonExists: false,
				reason: 'No package.json found - not a Node.js project'
			};
		}
	} catch (error) {
		console.error('Error checking repository eligibility:', error);
		return {
			isEligible: false,
			hasTailwind: false,
			packageJsonExists: false,
			reason: 'Error checking repository eligibility'
		};
	}
}

// Convenience function that combines cloning and analysis
export async function analyzeRepositoryLocal(
	owner: string,
	repo: string,
	branch?: string
): Promise<{
	files: GitHubFile[];
	eligibility: {
		isEligible: boolean;
		hasTailwind: boolean;
		packageJsonExists: boolean;
		reason?: string;
	};
	cleanup: () => Promise<void>;
	getFileContent: (filePath: string) => Promise<string | null>;
	defaultBranch: string;
} | null> {
	const repoInfo = await cloneRepository(owner, repo, branch);
	if (!repoInfo) return null;

	try {
		const [files, eligibility] = await Promise.all([
			getAllFilesLocal(repoInfo.localPath),
			checkRepositoryEligibilityLocal(repoInfo.localPath)
		]);

		// Get the actual branch that was cloned
		const actualBranch = branch || (await getDefaultBranch(owner, repo));

		return {
			files,
			eligibility,
			cleanup: repoInfo.cleanup,
			getFileContent: (filePath: string) => getFileContentLocal(repoInfo.localPath, filePath),
			defaultBranch: actualBranch
		};
	} catch (error) {
		console.error('Error analyzing repository:', error);
		await repoInfo.cleanup();
		return null;
	}
}
