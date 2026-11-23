export default {
  async fetch(): Promise<Response> {
    return new Response("mail-mcp");
  },
} satisfies ExportedHandler;
