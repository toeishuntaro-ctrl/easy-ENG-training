// index.html内のAPI呼び出し部
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userText: transcript,
    targetPhrase: currentTarget,
    japaneseGuide: currentGuide
  })
});
const result = await response.json();