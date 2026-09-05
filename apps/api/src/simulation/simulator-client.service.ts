import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "child_process";
import { join } from "path";
import { SimulatorRunInput, SimulatorRunOutput } from "@railopt/contracts";

const DEFAULT_TIMEOUT_MS = 30_000;

/** Same subprocess pattern as OptimizerClientService, targeting
 * services/simulator instead. See docs/SIMULATION_ASSUMPTIONS.md. */
@Injectable()
export class SimulatorClientService {
  private readonly logger = new Logger(SimulatorClientService.name);

  private get simulatorDir(): string {
    return process.env.SIMULATOR_SERVICE_DIR ?? join(process.cwd(), "..", "..", "services", "simulator");
  }

  private get pythonBin(): string {
    return process.env.PYTHON_BIN ?? "python3";
  }

  async run(input: SimulatorRunInput): Promise<SimulatorRunOutput> {
    const timeoutMs = process.env.SIMULATOR_TIMEOUT_MS ? Number(process.env.SIMULATOR_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;

    return new Promise<SimulatorRunOutput>((resolve, reject) => {
      const child = spawn(this.pythonBin, ["-m", "src.cli"], {
        cwd: this.simulatorDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new Error(`Simulator run timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to spawn simulator process: ${err.message}`));
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        if (stderr.trim()) {
          this.logger.debug(`simulator stderr: ${stderr.trim()}`);
        }

        if (code !== 0) {
          reject(new Error(`Simulator exited with code ${code}: ${stderr.trim() || "no stderr output"}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout) as SimulatorRunOutput);
        } catch (err) {
          reject(new Error(`Simulator produced invalid JSON: ${(err as Error).message}`));
        }
      });

      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    });
  }
}
