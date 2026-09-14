import { serveStdio } from '@modelcontextprotocol/server/stdio';

import {
  ARGUMENT_MCP_SERVER_NAME,
  ARGUMENT_MCP_SERVER_VERSION,
  createArgumentMcpServer,
} from './server';

const handle = serveStdio(() => createArgumentMcpServer());

console.error(
  `${ARGUMENT_MCP_SERVER_NAME} ${ARGUMENT_MCP_SERVER_VERSION} listening on stdio`,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void handle.close().finally(() => process.exit(0));
  });
}
