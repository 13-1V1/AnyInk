// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 finalize: the centerline vote on the font's slant (slant_vote.js) is on however the app
	loads, not only once the letter card (thickness.js) has loaded: follow.js, which every
	feature that moves shapes and the spacing step load, loads it too.
*/
import { describe, expect, it, vi } from 'vitest';

describe('slant_vote.js loads with follow.js', () => {
	it('importing follow.js alone hands the centerline vote to slant.js', async () => {
		vi.resetModules();
		await import('../follow.js');
		const { slantVoter } = await import('../../spacing/slant.js');
		expect(slantVoter()).toBeTypeOf('function');
	});
});
