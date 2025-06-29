import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile, stat, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

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

export async function cloneRepository(
	owner: string,
	repo: string,
	branch: string = 'main'
): Promise<LocalRepoInfo | null> {
	try {

		const tempDir = join(tmpdir(), `tallywind-${owner}-${repo}-${Date.now()}`);
		const repoUrl = `https:.com/${owner}/${repo}.git`;


		const cloneCommand = [
			'git clone',
			'--single-branch',
			'--depth=1',
			`--branch=${branch}`,
			repoUrl,
			tempDir
		].join(' ');

		console.log(`Cloning repository: ${owner}/${repo}`);
		await execAsync(cloneCommand);

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


export async function getAllFilesLocal(localPath: string): Promise<GitHubFile[]> {
	const files: GitHubFile[] = [];

	async function walkDirectory(dirPath: string, relativePath: string = ''): Promise<void> {
		try {
			const entries = await readdir(dirPath);

			for (const entry of entries) {
				.git directory and other hidden directories
				if (entry.startsWith('.')) continue;

				const fullPath = join(dirPath, entry);
				const relativeFilePath = relativePath ? join(relativePath, entry) : entry;
				const stats = await stat(fullPath);

				if (stats.isDirectory()) {
					await walkDirectory(fullPath, relativeFilePath);
				} else if (stats.isFile()) {
					files.push({
						name: entry,
						path: relativeFilePath.replace(/\\/g, '/'),
						sha: '', , but not needed for our use case
						type: 'file',
						url: '',
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


export async function analyzeRepositoryLocal(
	owner: string,
	repo: string,
	branch: string = 'main'
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
} | null> {
	const repoInfo = await cloneRepository(owner, repo, branch);
	if (!repoInfo) return null;

	try {
		const [files, eligibility] = await Promise.all([
			getAllFilesLocal(repoInfo.localPath),
			checkRepositoryEligibilityLocal(repoInfo.localPath)
		]);

		return {
			files,
			eligibility,
			cleanup: repoInfo.cleanup,
			getFileContent: (filePath: string) => getFileContentLocal(repoInfo.localPath, filePath)
		};
	} catch (error) {
		console.error('Error analyzing repository:', error);
		await repoInfo.cleanup();
		return null;
	}
}
