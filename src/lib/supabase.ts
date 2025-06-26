import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const supabase = createClient(
	PUBLIC_SUPABASE_URL,
	PUBLIC_SUPABASE_ANON_KEY
);

// Repository table functions
export async function getRepoByUrl(url: string) {
	const { data, error } = await supabase
		.from('repositories')
		.select('*')
		.eq('url', url)
		.single();
	
	if (error && error.code !== 'PGRST116') {
		console.error('Error fetching repository:', error);
		return null;
	}
	
	return data;
}

export async function insertRepo(url: string, name: string, owner: string) {
	const { data, error } = await supabase
		.from('repositories')
		.insert([{ url, name, owner, analyzed_at: new Date().toISOString() }])
		.select()
		.single();
	
	if (error) {
		console.error('Error inserting repository:', error);
		return null;
	}
	
	return data;
}

// Tailwind class count functions
export async function insertClassCounts(repoId: number, classCounts: Record<string, number>) {
	const rows = Object.entries(classCounts).map(([class_name, count]) => ({
		repo_id: repoId,
		class_name,
		count
	}));
	
	const { data, error } = await supabase
		.from('tailwind_classes')
		.insert(rows);
	
	if (error) {
		console.error('Error inserting class counts:', error);
		return false;
	}
	
	return true;
}

export async function getClassCountsForRepo(repoId: number) {
	const { data, error } = await supabase
		.from('tailwind_classes')
		.select('*')
		.eq('repo_id', repoId);
	
	if (error) {
		console.error('Error fetching class counts:', error);
		return [];
	}
	
	return data;
}

export async function getTopClassesGlobal(limit: number = 50) {
	const { data, error } = await supabase
		.rpc('get_top_classes_global', { limit_count: limit });
	
	if (error) {
		console.error('Error fetching global class stats:', error);
		return [];
	}
	
	return data;
}