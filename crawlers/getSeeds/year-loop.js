// WHEN TO USE:
// The source organises content by year and each year has its own index page.
// Generates one seed URL per year from startYear to the current year.

function getSeeds() {
  const currentYear = new Date().getFullYear();
  const startYear   = 2010; // adjust to the first year available on the source
  const seeds       = [];

  for (let year = startYear; year <= currentYear; year++) {
    seeds.push(`https://www.example.com/opinions/${year}`);
  }

  return seeds;
}
