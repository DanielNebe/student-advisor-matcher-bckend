import { interestCategories } from "./interestCategories.js";

export function mapToCategory(interest) {
  const lowerInterest = interest.toLowerCase();

  for (const [category, keywords] of Object.entries(interestCategories)) {
    if (keywords.includes(lowerInterest)) {
      return category;
    }
  }
  return interest; // return the original if not found in dictionary
}

export function mapInterestListToCategories(interests = []) {
  const mapped = new Set();

  interests.forEach((interest) => {
    const category = mapToCategory(interest);
    mapped.add(category);
  });

  return Array.from(mapped);
}
