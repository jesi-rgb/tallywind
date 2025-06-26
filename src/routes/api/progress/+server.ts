import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { analysisProgress } from '$lib/stores/progress';
import { get } from 'svelte/store';

// Get current analysis progress
export const GET = async (_: RequestEvent) => {
  const progress = get(analysisProgress);
  return json(progress || { status: 'none' });
};

// Update analysis progress
export const POST = async ({ request }: RequestEvent) => {
  try {
    const update = await request.json();
    analysisProgress.update(current => {
      if (!current) return update;
      return { ...current, ...update };
    });
    return json({ success: true });
  } catch (error) {
    console.error('Error updating progress:', error);
    return json({ error: 'Failed to update progress' }, { status: 400 });
  }
};