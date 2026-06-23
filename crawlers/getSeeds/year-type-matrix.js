// WHEN TO USE:
// The source segments content by both year and document type.
// Generates one seed per year × type combination.

function getSeeds() {
  const years = [2020, 2021, 2022, 2023, 2024, 2025];
  const types = ["circular", "resolution", "order"]; // adjust to source
  const seeds = [];

  for (const year of years) {
    for (const type of types) {
      seeds.push(`https://www.example.com/${type}/${year}`);
    }
  }

  return seeds;
}
