export async function onRequestPost() {
  return new Response(
    JSON.stringify({ reply: "Hello from the backend!" }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}
