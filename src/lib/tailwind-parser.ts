// Common file extensions where Tailwind classes might be used
const TAILWIND_FILE_EXTENSIONS = [
	// HTML and templates
	'.html',
	'.htm',
	'.xhtml',

	// React and React-based frameworks
	'.jsx',
	'.tsx',

	// Vue.js
	'.vue',

	// Svelte
	'.svelte',

	// Astro
	'.astro',

	// Solid.js
	'.solid',
	'.solid.js',
	'.solid.ts',

	// Angular
	'.component.html',
	'.component.ts',
	'.ng.html',

	// Lit (Web Components)
	'.lit.js',
	'.lit.ts',

	// Stencil
	'.stencil.tsx',

	// Qwik
	'.qwik.tsx',
	'.qwik.ts',

	// Remix
	'.remix.tsx',
	'.remix.ts',

	// Next.js specific
	'.page.tsx',
	'.page.ts',
	'.layout.tsx',
	'.layout.ts',

	// PHP (Laravel, etc.)
	'.php',
	'.blade.php',
	'.twig',

	// Ruby (Rails)
	'.erb',
	'.haml',
	'.slim',

	// Python (Django, Flask)
	'.html.py',
	'.jinja',
	'.jinja2',
	'.j2',

	// Go templates
	'.gohtml',
	'.gotmpl',
	'.tmpl',

	// Handlebars
	'.hbs',
	'.handlebars',

	// Mustache
	'.mustache',

	// Pug/Jade
	'.pug',
	'.jade',

	// EJS
	'.ejs',

	// Nunjucks
	'.njk',
	'.nunjucks',

	// Liquid (Shopify, Jekyll)
	'.liquid',

	// JSX/TSX in JS/TS files (catch broader patterns)
	'.js',
	'.ts',
	'.mjs',
	'.cjs',

	// MDX
	'.mdx',

	// Web Components
	'.webcomponent.js',
	'.webcomponent.ts',

	// HTMX enhanced HTML
	'.htmx.html',

	// Alpine.js enhanced HTML
	'.alpine.html'
];

// Regular expression to match class attributes in HTML-like templates
const CLASS_REGEX = /class(?:Name)?=(?:["']\s*([^"']*)\s*["']|{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*})/g;

// Regular expression to match tw, cls, clsx, classnames, and similar function calls
const CLASSNAME_FUNCTION_REGEX =
	/(?:tw|cls|clsx|classnames|cva)\((?:["']\s*([^"']*)\s*["']|{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}|(?:[^()]|{(?:[^{}]|{[^{}]*})*})*)\)/g;

// Extract Tailwind classes from file content
export function extractClasses(content: string): string[] {
	const classes: string[] = [];

	// Extract from class/className attributes
	let match;
	while ((match = CLASS_REGEX.exec(content)) !== null) {
		if (match[1]) {
			// Handle standard class="..." syntax
			const classString = match[1];
			const classNames = parseClassString(classString);
			classes.push(...classNames);
		} else {
			// Handle dynamic class bindings (approximate)
			const fullMatch = match[0];
			// Try to extract strings from the dynamic binding
			const stringMatches = fullMatch.match(/["']([^"']*)["']/g);
			if (stringMatches) {
				stringMatches.forEach((str) => {
					const cleaned = str.replace(/^["']|["']$/g, '');
					const extracted = parseClassString(cleaned);
					classes.push(...extracted);
				});
			}
		}
	}

	// Extract from function calls like tw, cls, clsx, etc.
	while ((match = CLASSNAME_FUNCTION_REGEX.exec(content)) !== null) {
		// Similar processing as above but for function arguments
		const fullMatch = match[0];
		const stringMatches = fullMatch.match(/["']([^"']*)["']/g);
		if (stringMatches) {
			stringMatches.forEach((str) => {
				const cleaned = str.replace(/^["']|["']$/g, '');
				const extracted = parseClassString(cleaned);
				classes.push(...extracted);
			});
		}
	}

	return classes;
}

// Parse a class string into individual classes
function parseClassString(classString: string): string[] {
	// Handle template literals or conditional classes
	const classes = classString
		.split(/\s+/)
		.filter(Boolean)
		.map((cls) => cls.trim());

	return classes;
}

// Check if a file should be parsed for Tailwind classes
export function shouldParseFile(fileName: string): boolean {
	const lowerCase = fileName.toLowerCase();

	// Skip common non-UI files even if they have matching extensions
	const skipPatterns = [
		'node_modules/',
		'.git/',
		'dist/',
		'build/',
		'coverage/',
		'.next/',
		'.nuxt/',
		'.output/',
		'vendor/',
		'__pycache__/',
		'.pytest_cache/',
		'target/',
		'bin/',
		'obj/',
		'.vscode/',
		'.idea/',
		'package-lock.json',
		'yarn.lock',
		'pnpm-lock.yaml',
		'.env',
		'config.js',
		'config.ts',
		'webpack.config',
		'vite.config',
		'rollup.config',
		'babel.config',
		'jest.config',
		'tailwind.config',
		'postcss.config',
		'.d.ts',
		'types.ts',
		'constants.ts',
		'utils.ts',
		'helpers.ts',
		'api.ts',
		'service.ts',
		'store.ts',
		'reducer.ts',
		'action.ts',
		'middleware.ts',
		'router.ts',
		'routes.ts'
	];

	// Skip if file matches any skip pattern
	if (skipPatterns.some((pattern) => lowerCase.includes(pattern))) {
		return false;
	}

	// Check if file extension matches any of our target extensions
	return TAILWIND_FILE_EXTENSIONS.some((ext) => lowerCase.endsWith(ext));
}

// Count occurrences of each Tailwind class
export function countTailwindClasses(
	files: { name: string; content: string }[]
): Record<string, number> {
	const classCounts: Record<string, number> = {};

	for (const file of files) {
		if (!shouldParseFile(file.name)) {
			continue;
		}

		const classes = extractClasses(file.content);

		for (const cls of classes) {
			classCounts[cls] = (classCounts[cls] || 0) + 1;
		}
	}

	return classCounts;
}
