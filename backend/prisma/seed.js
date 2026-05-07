/**
 * Seed script — creates demo users, Zimbabwe district reference table, and a set of
 * farmers with complete assessment data so the dashboard is alive on first run.
 * Six extra farmers are seeded via risk-band presets (two per Low / Medium / High) with
 * band-tuned environmental autofill rows.
 *
 * Run with:
 *   npm run seed
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { DISTRICTS } = require('../src/data/zimbabweDistricts');
const mediumBandPresets = require('./mediumBandPresets');

const prisma = new PrismaClient();

async function seedUsers() {
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', email: 'admin@fin-agri.zw', passwordHash: adminHash, role: 'ADMIN' },
  });
  const officerHash = await bcrypt.hash('officer123', 10);
  await prisma.user.upsert({
    where: { username: 'loan.officer' },
    update: {},
    create: { username: 'loan.officer', email: 'officer@fin-agri.zw', passwordHash: officerHash, role: 'LOAN_OFFICER' },
  });
  const managerHash = await bcrypt.hash('manager123', 10);
  await prisma.user.upsert({
    where: { username: 'credit.manager' },
    update: {},
    create: { username: 'credit.manager', email: 'manager@fin-agri.zw', passwordHash: managerHash, role: 'CREDIT_MANAGER' },
  });
}

async function seedDistricts() {
  for (const d of DISTRICTS) {
    await prisma.districtProfile.upsert({
      where: { district: d.district },
      update: {
        province: d.province,
        centroidLat: d.lat,
        centroidLon: d.lon,
        agroEcoZone: d.zone,
        rainfall90dClimMm: d.rain90,
        rainfall30dClimMm: d.rain30,
        ndviBaseline: d.ndvi,
        ndviVariability: d.ndviVar,
      },
      create: {
        province: d.province,
        district: d.district,
        centroidLat: d.lat,
        centroidLon: d.lon,
        agroEcoZone: d.zone,
        rainfall90dClimMm: d.rain90,
        rainfall30dClimMm: d.rain30,
        ndviBaseline: d.ndvi,
        ndviVariability: d.ndviVar,
      },
    });
  }
}

const DEMO_FARMERS = [
  {
    fullName: 'Tendai Moyo', gender: 'Male', age: 42, education: 'Secondary',
    province: 'Mashonaland East', district: 'Murehwa', ward: 'Ward 12',
    farmSizeHa: 3.2, phone: '+263 77 123 4567', householdSize: 5, maritalStatus: 'Married',
    income: { mainSource: 'Crop farming', mainAmount: 2400, secondarySource: 'Small business', secondaryAmount: 900, shockExperienced: false, copingIndex: 1, dietaryDiversity: 9 },
    activity: { cropType: 'Maize', estimatedYield: 3.6, irrigation: 'Partial', season: '2025/2026', inputUsage: 'High' },
    social: { groupMembership: true, groupName: 'Murehwa Smallholder Coop', yearsInGroup: 7, leadershipRole: 'Committee', guarantorAvailable: true },
    loan: { amount: 1800, purpose: 'Seed and fertilizer inputs' },
  },
  {
    fullName: 'Chipo Ndlovu', gender: 'Female', age: 36, education: 'Tertiary',
    province: 'Matabeleland South', district: 'Gwanda', ward: 'Ward 5',
    farmSizeHa: 2.0, phone: '+263 71 234 5678', householdSize: 4, maritalStatus: 'Married',
    income: { mainSource: 'Mixed farming', mainAmount: 1600, secondarySource: 'Remittances', secondaryAmount: 1200, shockExperienced: true, copingIndex: 2, dietaryDiversity: 7 },
    activity: { cropType: 'Sorghum', estimatedYield: 1.2, irrigation: 'No', season: '2025/2026', inputUsage: 'Medium' },
    social: { groupMembership: true, groupName: 'Gwanda Women in Agri', yearsInGroup: 4, leadershipRole: 'Member', guarantorAvailable: true },
    loan: { amount: 900, purpose: 'Livestock restocking' },
  },
  {
    fullName: 'Farai Chikowore', gender: 'Male', age: 29, education: 'Secondary',
    province: 'Manicaland', district: 'Mutasa', ward: 'Ward 8',
    farmSizeHa: 1.5, phone: '+263 78 345 6789', householdSize: 3, maritalStatus: 'Single',
    income: { mainSource: 'Crop farming', mainAmount: 3200, secondarySource: 'Casual labour', secondaryAmount: 600, shockExperienced: false, copingIndex: 1, dietaryDiversity: 10 },
    activity: { cropType: 'Horticulture', estimatedYield: 4.1, irrigation: 'Yes', season: '2025/2026', inputUsage: 'High' },
    social: { groupMembership: true, groupName: 'Mutasa Horticulture Group', yearsInGroup: 3, leadershipRole: 'Member', guarantorAvailable: true },
    loan: { amount: 2400, purpose: 'Irrigation equipment' },
  },
  {
    fullName: 'Rudo Sibanda', gender: 'Female', age: 48, education: 'Primary',
    province: 'Midlands', district: 'Gokwe South', ward: 'Ward 3',
    farmSizeHa: 4.5, phone: '+263 77 456 7890', householdSize: 8, maritalStatus: 'Widowed',
    income: { mainSource: 'Crop farming', mainAmount: 1100, shockExperienced: true, copingIndex: 3, dietaryDiversity: 5 },
    activity: { cropType: 'Cotton', estimatedYield: 1.4, irrigation: 'No', season: '2025/2026', inputUsage: 'Low' },
    social: { groupMembership: false, guarantorAvailable: false },
    loan: { amount: 1500, purpose: 'Farm expansion' },
  },
  {
    fullName: 'Kuda Mupfigo', gender: 'Male', age: 33, education: 'A-Level',
    province: 'Mashonaland Central', district: 'Bindura', ward: 'Ward 7',
    farmSizeHa: 2.8, phone: '+263 71 567 8901', householdSize: 4, maritalStatus: 'Married',
    income: { mainSource: 'Crop farming', mainAmount: 2800, secondarySource: 'Salaried employment', secondaryAmount: 1800, thirdSource: 'Small business', thirdAmount: 500, shockExperienced: false, copingIndex: 1, dietaryDiversity: 11 },
    activity: { cropType: 'Tobacco', estimatedYield: 2.9, irrigation: 'Partial', season: '2025/2026', inputUsage: 'High' },
    social: { groupMembership: true, groupName: 'Bindura Tobacco Growers', yearsInGroup: 9, leadershipRole: 'Chair', guarantorAvailable: true },
    loan: { amount: 3500, purpose: 'Tractor services' },
  },
  {
    fullName: 'Hazel Murombedzi', gender: 'Female', age: 34, education: 'Tertiary',
    province: 'Mashonaland West', district: 'Zvimba', ward: 'Ward 7',
    farmSizeHa: 4.0, phone: '+263 78 864 8983', householdSize: 5, maritalStatus: 'Married',
    income: { mainSource: 'Mixed farming', mainAmount: 2600, secondarySource: 'Small business', secondaryAmount: 1100, shockExperienced: false, copingIndex: 1, dietaryDiversity: 10 },
    activity: { cropType: 'Maize', estimatedYield: 3.2, irrigation: 'Partial', season: '2025/2026', inputUsage: 'High' },
    social: { groupMembership: true, groupName: 'Zvimba Maize Farmers', yearsInGroup: 5, leadershipRole: 'Member', guarantorAvailable: true },
    loan: { amount: 2000, purpose: 'Seed and fertilizer inputs' },
  },
];

async function seedFarmers() {
  for (const f of DEMO_FARMERS) {
    const farmer = await prisma.farmer.create({
      data: {
        fullName: f.fullName, gender: f.gender, age: f.age, education: f.education,
        province: f.province, district: f.district, ward: f.ward,
        farmSizeHa: f.farmSizeHa, phone: f.phone,
        householdSize: f.householdSize, maritalStatus: f.maritalStatus,
      },
    });

    await prisma.householdIncome.create({
      data: { farmerId: farmer.id, ...f.income },
    });

    await prisma.farmActivity.create({
      data: { farmerId: farmer.id, ...f.activity },
    });

    await prisma.socialCapital.create({
      data: { farmerId: farmer.id, ...f.social },
    });

    await prisma.asset.create({
      data: {
        farmerId: farmer.id,
        assetType: 'Livestock',
        assetName: 'Cattle',
        quantity: Math.max(0, Math.round((f.income.mainAmount / 800))),
        estimatedValue: Math.round((f.income.mainAmount / 800) * 350),
      },
    });

    const app = await prisma.loanApplication.create({
      data: {
        farmerId: farmer.id,
        amountRequested: f.loan.amount,
        purpose: f.loan.purpose,
        season: '2025/2026',
        status: 'PENDING',
      },
    });

    const districtProfile = await prisma.districtProfile.findUnique({ where: { district: f.district } });
    if (districtProfile) {
      const wetBias = (Math.random() - 0.5) * 0.3; 
      const rain30 = Math.round(districtProfile.rainfall30dClimMm * (1 + wetBias));
      const rain90 = Math.round(districtProfile.rainfall90dClimMm * (1 + wetBias * 0.7));
      const ndviMean = Math.round(districtProfile.ndviBaseline * (1 + wetBias * 0.5) * 1000) / 1000;
      const ndviStd = Math.round(districtProfile.ndviVariability * 1000) / 1000;
      const envScore = Math.round(Math.max(10, Math.min(95, 45 + wetBias * 80)));
      const envRisk = envScore >= 65 ? 'Low' : envScore >= 40 ? 'Medium' : 'High';

      await prisma.satelliteData.create({
        data: {
          applicationId: app.id,
          rainfall30dMm: rain30,
          rainfall90dMm: rain90,
          rainfallAnomaly: Math.round(wetBias * 1000) / 1000,
          ndvi90dMean: ndviMean,
          ndvi90dStd: ndviStd,
          environmentScore: envScore,
          environmentRisk: envRisk,
          source: 'District climatology (seeded)',
          sourceKind: 'fallback',
          provenance: {
            rainfall30dMm: 'user_confirmed',
            rainfall90dMm: 'user_confirmed',
            rainfallAnomaly: 'user_confirmed',
            ndvi90dMean: 'user_confirmed',
            ndvi90dStd: 'user_confirmed',
            environmentScore: 'user_confirmed',
            environmentRisk: 'user_confirmed',
          },
          confirmedAt: new Date(),
          confirmedBy: 'seed',
          observationDate: new Date(),
        },
      });
    }
  }
}

async function seedMediumBandDemosWrapped() {
  const r = await mediumBandPresets.seedMediumBandDemos(prisma);
  let extra = '';
  if (r.inserted > 0 && r.liveScored != null) {
    extra = ` (${r.liveScored} live inference, ${r.presetFallback} preset fallback)`;
  }
  console.log(
    `  ✓ Risk-band presets (2× Low / Medium / High): ${r.inserted} inserted, ${r.skipped} skipped (already present)${extra}`
  );
}

async function main() {
  console.log('Seeding Fin-Agri Score demo data…');
  await seedUsers();
  await seedDistricts();
  console.log(`  ✓ Seeded ${DISTRICTS.length} Zimbabwe district profiles`);
  await seedFarmers();
  console.log(`  ✓ Seeded ${DEMO_FARMERS.length} farmers with complete assessment data`);
  await seedMediumBandDemosWrapped();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    prisma.$disconnect();
  });
