import type { Repository } from "./db/schema";

export type SSEEventType = 'progress' | 'file-processed' | 'completed' | 'error';

export type SSEProgressEvent = {
	type: 'progress';
	data: {
		status: 'fetching' | 'parsing' | 'analyzing' | 'saving' | 'completed';
		filesProcessed?: number;
		totalFiles?: number;
		currentFile?: string;
		repoId?: number;
	};
};

export type SSEFileProcessedEvent = {
	type: 'file-processed';
	data: {
		filePath: string;
		classesFound: number;
		filesProcessed: number;
		totalFiles: number;
	};
};

export type SSECompletedEvent = {
	type: 'completed';
	data: {
		repo: Repository;
		totalClasses: number;
		topClasses: Array<{ className: string; count: number }>;
		classCounts: Record<string, number>;
	};
};

export type SSEErrorEvent = {
	type: 'error';
	data: {
		message: string;
		repoId?: number;
	};
};

export type SSEEvent = SSEProgressEvent | SSEFileProcessedEvent | SSECompletedEvent | SSEErrorEvent;

export class SSEEmitter {
	private controller: ReadableStreamDefaultController<string>;

	constructor(controller: ReadableStreamDefaultController<string>) {
		this.controller = controller;
	}

	emit(event: SSEEvent) {
		const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
		this.controller.enqueue(sseData);
	}

	close() {
		this.controller.close();
	}
}

export function createSSEResponse(): { response: Response; emitter: SSEEmitter } {
	let controller: ReadableStreamDefaultController<string>;

	const stream = new ReadableStream<string>({
		start(ctrl) {
			controller = ctrl;
			// Send initial connection event
			controller.enqueue('event: connected\ndata: {}\n\n');
		}
	});

	const response = new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Cache-Control'
		}
	});

	const emitter = new SSEEmitter(controller!);

	return { response, emitter };
}
