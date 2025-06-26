import { env } from '$env/dynamic/private';

// Define types
type GitHubFile = {
	name: string;
	path: string;
	sha: string;
	type: 'file' | 'dir';
	url: string;
	download_url: string | null;
};

type GitHubRepo = {
	name: string;
	owner: {
		login: string;
	};
	default_branch: string;
};

// Extract owner and repo name from GitHub URL
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
	// Handle different GitHub URL formats
	const patterns = [
		/github\.com\/([^/]+)\/([^/]+)\/?$/,  // github.com/owner/repo
		/github\.com\/([^/]+)\/([^/]+)\//     // github.com/owner/repo/anything
	];

	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match) {
			return {
				owner: match[1],
				repo: match[2].replace('.git', '')
			};
		}
	}

	return null;
}

// API request helper with auth
async function githubFetch(url: string) {
	const headers: HeadersInit = {
		'Accept': 'application/vnd.github.v3+json',
		'User-Agent': 'TallywindApp'
	};

	// Add auth token if available
	if (env.GITHUB_TOKEN) {
		headers['Authorization'] = `token ${env.GITHUB_TOKEN}`;
	}

	return fetch(url, { headers });
}

// Get repository information
export async function getRepository(owner: string, repo: string): Promise<GitHubRepo | null> {
	try {
		const response = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`);

		if (!response.ok) {
			console.error(`Error fetching repo: ${response.status}`);
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error('Error fetching repository:', error);
		return null;
	}
}

// Recursively get all files in a repository
export async function getAllFiles(owner: string, repo: string, branch: string): Promise<GitHubFile[]> {
	try {
		let allFiles: GitHubFile[] = [];
		const queue: { path: string }[] = [{ path: '' }];

		while (queue.length > 0) {
			const { path } = queue.shift()!;
			const url = path
				? `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
				: `https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`;

			const response = await githubFetch(url);

			if (!response.ok) {
				console.error(`Error fetching contents for ${path}: ${response.status}`);
				continue;
			}

			const contents: GitHubFile[] = await response.json();

			for (const item of contents) {
				if (item.type === 'dir') {
					queue.push({ path: item.path });
				} else if (item.type === 'file') {
					allFiles.push(item);
				}
			}

			// Rate limit handling
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		return allFiles;
	} catch (error) {
		console.error('Error getting all files:', error);
		return [];
	}
}

// Get file content
export async function getFileContent(fileUrl: string): Promise<string | null> {
	try {
		const response = await githubFetch(fileUrl);

		if (!response.ok) {
			console.error(`Error fetching file content: ${response.status}`);
			return null;
		}

		const data = await response.json();
		return atob(data.content); // GitHub API returns base64 encoded content
	} catch (error) {
		console.error('Error getting file content:', error);
		return null;
	}
}

// Check if repository is eligible for Tailwind analysis
export async function checkRepositoryEligibility(owner: string, repo: string, branch: string): Promise<{
	isEligible: boolean;
	hasTailwind: boolean;
	packageJsonExists: boolean;
	reason?: string;
}> {
	try {
		// First, check if package.json exists
		const packageJsonUrl = `https://api.github.com/repos/${owner}/${repo}/contents/package.json?ref=${branch}`;
		const packageResponse = await githubFetch(packageJsonUrl);
		
		if (!packageResponse.ok) {
			return {
				isEligible: false,
				hasTailwind: false,
				packageJsonExists: false,
				reason: 'No package.json found - not a Node.js project'
			};
		}

		// Get package.json content
		const packageData = await packageResponse.json();
		const packageContent = atob(packageData.content);
		
		let packageJson;
		try {
			packageJson = JSON.parse(packageContent);
		} catch (error) {
			return {
				isEligible: false,
				hasTailwind: false,
				packageJsonExists: true,
				reason: 'Invalid package.json format'
			};
		}

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
		console.error('Error checking repository eligibility:', error);
		return {
			isEligible: false,
			hasTailwind: false,
			packageJsonExists: false,
			reason: 'Error checking repository eligibility'
		};
	}
}
