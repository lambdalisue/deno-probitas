export type SubcommandOptions = {
  cwd?: string;
  output?: WritableStream<Uint8Array>;
  signal?: AbortSignal;
};

export class AppConsole implements AsyncDisposable {
  #stream: WritableStream<Uint8Array>;
  #buffer: string[] = [];
  #writer: Promise<void> | null = null;
  #disposed = false;

  constructor(stream: WritableStream<Uint8Array> = Deno.stdout.writable) {
    this.#stream = stream;
  }

  async #dump(): Promise<void> {
    const buffer = this.#buffer.splice(0, this.#buffer.length);
    await ReadableStream.from(buffer)
      .pipeThrough(new TextEncoderStream())
      .pipeTo(this.#stream);
  }

  #append(line: string): void {
    if (this.#disposed) {
      throw new Error("Cannot write to disposed Output");
    }
    this.#buffer.push(line);
    if (!this.#writer) {
      this.#writer = this.#dump().then(() => {
        this.#writer = null;
      });
    }
  }

  #format(v: unknown): string {
    if (typeof v === "string") {
      return v;
    } else {
      return Deno.inspect(v);
    }
  }

  log(...args: readonly unknown[]): void {
    const items = args.map(this.#format);
    const message = items.join(" ") + "\n";
    this.#append(message);
  }

  debug(...args: readonly unknown[]): void {
    const items = args.map(this.#format);
    const message = items.join(" ") + "\n";
    this.#append(`[DEBUG] ${message}`);
  }

  info(...args: readonly unknown[]): void {
    const items = args.map(this.#format);
    const message = items.join(" ") + "\n";
    this.#append(`[INFO ] ${message}`);
  }

  warn(...args: readonly unknown[]): void {
    const items = args.map(this.#format);
    const message = items.join(" ") + "\n";
    this.#append(`[WARN ] ${message}`);
  }

  error(...args: readonly unknown[]): void {
    const items = args.map(this.#format);
    const message = items.join(" ") + "\n";
    this.#append(`[ERROR] ${message}`);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this.#writer) {
      await this.#writer;
    }
    this.#disposed = true;
  }
}
