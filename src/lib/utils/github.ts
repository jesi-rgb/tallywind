/**
 * Normalizes various GitHub URL formats to a standard full URL
 *
 * Handles:
 * - Full URL: https://github.com/owner/name
 * - Short form: owner/name
 * - Full URL with paths: https://github.com/owner/name/tree/main or any other path
 *
 * @param input - The GitHub repository input string
 * @returns Normalized GitHub repository URL
 * @throws Error if the input is not a valid GitHub repository format
 */
export function normalizeGitHubUrl(input: string): string {
	if (!input || typeof input !== 'string') {
		throw new Error('Repository input is required');
	}

	const trimmed = input.trim();

	// Remove trailing slash if present
	const cleaned = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;

	// Case 1: Short form (owner/name)
	if (/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(cleaned)) {
		return `https://github.com/${cleaned}`;
	}

	// Case 2: Full URL or URL with paths
	let url: URL;
	try {
		// If it doesn't start with http/https, assume it's missing the protocol
		const urlString = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
		url = new URL(urlString);
	} catch {
		throw new Error('Invalid URL format');
	}

	// Validate it's a GitHub URL
	if (url.hostname !== 'github.com') {
		throw new Error('URL must be from github.com');
	}

	// Extract owner and repo from pathname
	const pathParts = url.pathname.split('/').filter((part) => part.length > 0);

	if (pathParts.length < 2) {
		throw new Error('Invalid GitHub repository URL - missing owner or repository name');
	}

	const [owner, repo] = pathParts;

	// Validate owner and repo names (GitHub username/repo name rules)
	const validNamePattern = /^[a-zA-Z0-9._-]+$/;
	if (!validNamePattern.test(owner) || !validNamePattern.test(repo)) {
		throw new Error('Invalid GitHub repository name format');
	}

	// Return normalized URL (just the base repository URL)
	return `https://github.com/${owner}/${repo}`;
}

/**
 * Extracts owner and repository name from a GitHub URL
 *
 * @param githubUrl - Normalized GitHub URL
 * @returns Object with owner and name properties
 */
export function parseGitHubUrl(githubUrl: string): { owner: string; name: string } {
	const url = new URL(githubUrl);
	const [owner, name] = url.pathname.split('/').filter((part) => part.length > 0);

	return { owner, name };
}
