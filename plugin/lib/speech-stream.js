/** Split visible assistant text into early, bounded speech segments. */
export function createSpeechStream(emit) {
  let key = null;
  let pending = '';
  let streamed = false;
  const reset = () => { key = null; pending = ''; streamed = false; };
  const drain = (final = false) => {
    while (pending) {
      let end = 0;
      for (let i = 0; i < Math.min(pending.length, 120); i++) {
        const char = pending[i];
        if (/[。！？!?；;\n]/u.test(char) || (/[，,：:]/u.test(char) && i >= 23) || (char === '.' && /\s/u.test(pending[i + 1] || ''))) {
          end = i + 1;
          break;
        }
      }
      if (!end && pending.length >= 120) {
        const space = pending.lastIndexOf(' ', 120);
        end = space >= 60 ? space + 1 : 120;
        if (/[\uD800-\uDBFF]/u.test(pending[end - 1])) end--;
      }
      if (!end && final) end = pending.length;
      if (!end) return;
      const text = pending.slice(0, end).trim();
      pending = pending.slice(end);
      if (text) emit({ kind: 'speech', text });
    }
  };
  let blocked = false;
  const accept = (event) => {
    if (event.type === 'turn/start') blocked = false;
    if (blocked) return;
    if (event.type === 'turn/end' || event.type === 'step/end') { reset(); return; }
    if (event.type !== 'assistant/chunk' && event.type !== 'assistant/message') return;
    const id = `${event.data.turn}:${event.data.step}`;
    if (key !== id) { reset(); key = id; }
    if (event.type === 'assistant/chunk') {
      const chunk = event.data.chunk;
      if (chunk.type === 'text-delta') {
        streamed = true;
        pending += chunk.text;
        drain();
      } else if (chunk.type === 'finish') {
        if (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted') reset();
        else drain(true);
      }
    } else {
      if (!event.data.interrupted) {
        if (!streamed) pending = event.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('');
        drain(true);
      }
      reset();
    }
  };
  accept.interrupt = () => { reset(); blocked = true; };
  return accept;
}
