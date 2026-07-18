
// 本地数据
const documents = new Map();

const tokenize = (input) => {
  const text = input.toLowerCase();
  // Intl.Segmenter
  const segmenter = new Intl.Segmenter('zh-CN',{
    granularity: "word"
  });
  return new Set(
    [...segmenter.segment(text)]
      .filter(item => item.isWordLike)
      .map(item => item.segment.trim())
      .filter(token => token.length > 0)
  )
}

// 添加当前文本
// 分词 
export const addDocument = (title, content) => {
  const id = `doc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const tokens = tokenize(`${title} ${content}`);
  documents.set(id, {
    id,
    title,
    content,
    tokens
  });
  return { id, title, content, tokens: [...tokens] }
}

// 获取所有文本
export const listDocuments = () => {
  return [...documents.values()].map(({id, title, content})=> ({
    id,
    title,
    contentLength: content.length
  }))
}

export function score(queryTokens, documentTokens) {
  let hits = 0;
  for ( const token of queryTokens ) {
    if (documentTokens.has(token)) {
      hits += 1;
    }
  }
  // score: 0-1
  return hits / Math.max(queryTokens.size, 1);
}

// 搜索
export function searchDocuments(query, topK) {
  /**
   * 1. 要给 问题 分词
   * 2. 根据问题的分词，给每一条输入的数据进行打分
   * 3. 根据打分排名 分数最高的排前面
   * 4. 截取 topK 的长度
   * */ 
  const queryTokens = tokenize(query);
  return [...documents.values()]
    .map(document => ({
      id: document.id,
      title: document.title,
      content: document.content,
      score: score(queryTokens, document.tokens),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}
