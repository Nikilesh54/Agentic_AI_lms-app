/**
 * Manual harness: score a known response against a course and print the breakdown.
 * Usage: npx ts-node src/scripts/verify-validation-score.ts <courseId> "<response text>"
 */
import { computeValidationScore } from '../services/scoring/validationScore';

async function main() {
  const courseId = parseInt(process.argv[2], 10);
  const response = process.argv[3];
  if (!courseId || !response) {
    console.error('Usage: npx ts-node src/scripts/verify-validation-score.ts <courseId> "<response>"');
    process.exit(1);
  }
  const result = await computeValidationScore(response, courseId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
main();
