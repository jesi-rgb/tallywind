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

type RateLimitInfo = {
	remaining: number;
	reset: number;
	retryAfter?: number;
};

// Extract owner and repo name from GitHub URL
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
	// Handle different GitHub URL formats
	const patterns = [
		/github\.com\/([^/]+)\/([^/]+)\/?$/, // github.com/owner/repo
		/github\.com\/([^/]+)\/([^/]+)\// // github.com/owner/repo/anything
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

// Rate limit helper functions
function parseRateLimitHeaders(response: Response): RateLimitInfo {
	const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '0');
	const reset = parseInt(response.headers.get('x-ratelimit-reset') || '0');
	const retryAfter = response.headers.get('retry-after');

	return {
		remaining,
		reset,
		retryAfter: retryAfter ? parseInt(retryAfter) : undefined
	};
}

function calculateDelayMs(rateLimitInfo: RateLimitInfo): number {
	// If we have a retry-after header, use that
	if (rateLimitInfo.retryAfter) {
		return rateLimitInfo.retryAfter * 1000;
	}

	// If we're close to the rate limit, add a small delay
	if (rateLimitInfo.remaining <= 10) {
		const now = Math.floor(Date.now() / 1000);
		const resetIn = rateLimitInfo.reset - now;

		// If reset is soon, wait for it
		if (resetIn > 0 && resetIn <= 60) {
			return resetIn * 1000;
		}

		// Otherwise add a small delay to avoid hitting the limit
		return 1000;
	}

	// No delay needed
	return 0;
}

// API request helper with auth and rate limiting
async function githubFetch(url: string): Promise<Response> {
	const headers: HeadersInit = {
		Accept: 'application/vnd.github.v3+json',
		'User-Agent': 'TallywindApp'
	};

	// Add auth token if available
	if (env.GITHUB_TOKEN) {
		headers['Authorization'] = `token ${env.GITHUB_TOKEN}`;
	}

	const response = await fetch(url, { headers });

	// Handle rate limiting
	if (response.status === 403 || response.status === 429) {
		const rateLimitInfo = parseRateLimitHeaders(response);
		const delayMs = calculateDelayMs(rateLimitInfo);

		if (delayMs > 0) {
			console.log(`Rate limited. Waiting ${delayMs}ms before retry...`);
			await new Promise((resolve) => setTimeout(resolve, delayMs));
			// Retry the request once
			return fetch(url, { headers });
		}
	}

	return response;
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

// Get all files in a repository using the Trees API (single request)
export async function getAllFiles(
	owner: string,
	repo: string,
	branch: string
): Promise<GitHubFile[]> {
	try {
		// First get the commit SHA for the branch
		const branchResponse = await githubFetch(
			`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`
		);

		if (!branchResponse.ok) {
			console.error(`Error fetching branch ${branch}: ${branchResponse.status}`);
			return [];
		}

		const branchData = await branchResponse.json();
		const treeSha = branchData.commit.commit.tree.sha;

		// Use the Trees API to get all files recursively in one request
		const treeResponse = await githubFetch(
			`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`
		);

		if (!treeResponse.ok) {
			console.error(`Error fetching tree: ${treeResponse.status}`);
			return [];
		}

		const treeData = await treeResponse.json();

		// Convert tree items to GitHubFile format, filtering only files
		const allFiles: GitHubFile[] = treeData.tree
			.filter((item: any) => item.type === 'blob') // Only files, not directories
			.map((item: any) => ({
				name: item.path.split('/').pop() || item.path,
				path: item.path,
				sha: item.sha,
				type: 'file' as const,
				url: `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`,
				download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`
			}));

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
export async function checkRepositoryEligibility(
	owner: string,
	repo: string,
	branch: string
): Promise<{
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
