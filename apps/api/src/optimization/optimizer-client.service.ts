import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "child_process";
import { join } from "path";
import { OptimizerRunInput, OptimizerRunOutput } from "@railopt/contracts";

const DEFAULT_TIMEOUT_MS = 60_000;

/** Thin wrapper around `python3 -m src.cli` (services/optimizer). JSON in on
 * stdin, JSON out on stdout, logs on stderr - never mixed with the result.
 * See docs/ARCHITECTURE.md for why this is a subprocess, not a microservice. */
@Injectable()
export class OptimizerClientService {
  private readonly logger = new Logger(OptimizerClientService.name);

  private get optimizerDir(): string {
    // apps/api runs with cwd=apps/api in both dev and the Docker image.
    return process.env.OPTIMIZER_SERVICE_DIR ?? join(process.cwd(), "..", "..", "services", "optimizer");
  }

  private get pythonBin(): string {
    return process.env.PYTHON_BIN ?? "python3";
  }

  async run(input: OptimizerRunInput): Promise<OptimizerRunOutput> {
    const timeoutMs = process.env.OPTIMIZER_TIMEOUT_MS ? Number(process.env.OPTIMIZER_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;

    return new Promise<OptimizerRunOutput>((resolve, reject) => {
      const child = spawn(this.pythonBin, ["-m", "src.cli"], {
        cwd: this.optimizerDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new Error(`Optimizer run timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to spawn optimizer process: ${err.message}`));
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        if (stderr.trim()) {
          this.logger.debug(`optimizer stderr: ${stderr.trim()}`);
        }

        if (code !== 0) {
          reject(new Error(`Optimizer exited with code ${code}: ${stderr.trim() || "no stderr output"}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout) as OptimizerRunOutput);
        } catch (err) {
          reject(new Error(`Optimizer produced invalid JSON: ${(err as Error).message}`));
        }
      });

      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    });
  }
}
