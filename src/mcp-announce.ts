import dgram from "dgram";

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface DiscoveryResponderOptions {
  name: string;
  description: string;
  tools: ToolDefinition[];
  port?: number;
  path?: string;
  listenPort?: number;
}

export function createDiscoveryResponder({
  name,
  description,
  tools,
  port = 9099,
  path,
  listenPort = 9099,
}: DiscoveryResponderOptions): dgram.Socket {
  const payload: Record<string, unknown> = {
    type: "announce",
    name,
    description,
    tools,
    port,
  };
  if (path) payload.path = path;
  const manifest = JSON.stringify(payload);

  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("message", (data, rinfo) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "discovery") {
        console.log(
          `Discovery request from ${rinfo.address}:${rinfo.port}, announcing`
        );
        socket.send(manifest, rinfo.port, rinfo.address);
      }
    } catch {
      // ignore malformed messages
    }
  });

  socket.on("error", (err) => {
    console.error("Announce socket error:", err.message);
  });

  socket.bind(listenPort, "0.0.0.0", () => {
    socket.addMembership("239.255.99.1");
    console.log(
      `Discovery responder listening on UDP :${listenPort} (multicast 239.255.99.1) for ${name}`
    );
  });

  return socket;
}
