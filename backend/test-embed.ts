import { pipeline } from '@xenova/transformers';

async function test() {
  console.log("Loading model...");
  const generateEmbedding = await pipeline('feature-extraction', 'Xenova/nomic-embed-text-v1.5', {
    quantized: true,
  });

  const output = await generateEmbedding('Hello world', {
    pooling: 'mean',
    normalize: true,
  });

  console.log('Embedding shape:', output.dims);
  console.log('Embedding data length:', Array.from(output.data).length);
}

test().catch(console.error);
