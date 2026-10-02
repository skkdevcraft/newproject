import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
} from '@earendil-works/pi-coding-agent';

/**
 * Calls Pi via the SDK and returns the assistant's response as a string.
 * @param prompt The user message to send to Pi.
 * @returns The assistant's final response.
 */
export async function ai(prompt: string): Promise<string> {
  // 1. Create a ModelRuntime (replaces AuthStorage + ModelRegistry)
  const modelRuntime = await ModelRuntime.create();

  // 2. Create an in-memory session
  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    modelRuntime,
  });

  // 3. Collect streamed text deltas as they arrive
  let responseText = '';
  session.subscribe((event) => {
    if (
      event.type === 'message_update' &&
      event.assistantMessageEvent.type === 'text_delta'
    ) {
      responseText += event.assistantMessageEvent.delta;
    }
  });

  // 4. Send the prompt and wait for the full run to finish.
  await session.prompt(prompt);

  // 5. Cleanup the session
  session.dispose();

  return responseText;
}

ai('List all files in the current directory and summarize what this project does.')
  .then((response) => console.log('Pi Response:\n', response))
  .catch((err) => console.error('Error:', err));
