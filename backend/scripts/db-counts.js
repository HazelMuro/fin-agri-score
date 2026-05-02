require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [farmers, apps, users, districts, scores] = await Promise.all([
    prisma.farmer.count(),
    prisma.loanApplication.count(),
    prisma.user.count(),
    prisma.districtProfile.count(),
    prisma.creditScore.count(),
  ]);
  console.log('Row counts (what the API uses):');
  console.log('  Farmer           ', farmers);
  console.log('  LoanApplication  ', apps);
  console.log('  User             ', users);
  console.log('  DistrictProfile  ', districts);
  console.log('  CreditScore      ', scores);
  if (farmers === 0) {
    console.log('\nNo farmers yet. From backend/ run: npm run seed');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
