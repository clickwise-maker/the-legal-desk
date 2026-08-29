import { PrismaClient, UserRole, BookingStatus, FormStatus, TransactionType } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const SPECIALIZATIONS = [
  "Criminal Law",
  "Family Law",
  "Corporate Law",
  "Property & Real Estate",
  "Tax Law",
  "Intellectual Property",
  "Civil Litigation",
  "Employment Law",
  "Immigration Law",
  "Contract Law",
  "Consumer Protection",
  "Bankruptcy & Insolvency",
];

const LAWYERS = [
  {
    name: "Meera Krishnan",
    email: "meera@legalflow.example",
    barCouncilId: "BC-MEERA001",
    experienceYears: 14,
    hourlyRate: 2500,
    bio: "Senior family-law advocate with 14 years handling matrimonial, custody and succession matters across Karnataka.",
    city: "Bengaluru",
    specializations: ["Family Law", "Property & Real Estate"],
    verified: true,
  },
  {
    name: "Rahul Mehta",
    email: "rahul@legalflow.example",
    barCouncilId: "BC-RAHUL002",
    experienceYears: 9,
    hourlyRate: 2000,
    bio: "Corporate and contract specialist advising startups on incorporations, funding rounds and commercial agreements.",
    city: "Mumbai",
    specializations: ["Corporate Law", "Contract Law"],
    verified: true,
  },
  {
    name: "Sneha Iyer",
    email: "sneha@legalflow.example",
    barCouncilId: "BC-SNEHA003",
    experienceYears: 11,
    hourlyRate: 2200,
    bio: "Taxation and GST expert, previously with a Big-4 tax practice. Trusted by SMEs for compliance.",
    city: "Delhi",
    specializations: ["Tax Law", "Corporate Law"],
    verified: true,
  },
  {
    name: "Arjun Nair",
    email: "arjun@legalflow.example",
    barCouncilId: "BC-ARJUN004",
    experienceYears: 7,
    hourlyRate: 1800,
    bio: "Criminal defence lawyer handling bail applications, trials and high-stakes white-collar cases.",
    city: "Chennai",
    specializations: ["Criminal Law", "Civil Litigation"],
    verified: false,
  },
  {
    name: "Priya Deshpande",
    email: "priya@legalflow.example",
    barCouncilId: "BC-PRIYA005",
    experienceYears: 6,
    hourlyRate: 1500,
    bio: "IP attorney for trademarks, copyright and patents. Helps creators protect their work.",
    city: "Pune",
    specializations: ["Intellectual Property", "Contract Law"],
    verified: true,
  },
  {
    name: "Vikram Singh",
    email: "vikram@legalflow.example",
    barCouncilId: "BC-VIKRAM006",
    experienceYears: 12,
    hourlyRate: 2400,
    bio: "Employment and labour law specialist. Handles severance, workplace disputes and HR policies.",
    city: "Gurugram",
    specializations: ["Employment Law", "Civil Litigation"],
    verified: true,
  },
  {
    name: "Ananya Gupta",
    email: "ananya@legalflow.example",
    barCouncilId: "BC-ANANYA007",
    experienceYears: 8,
    hourlyRate: 1900,
    bio: "Immigration counsel with a focus on work visas, permanent residency and citizenship filings.",
    city: "Hyderabad",
    specializations: ["Immigration Law", "Family Law"],
    verified: false,
  },
  {
    name: "Karthik Rao",
    email: "karthik@legalflow.example",
    barCouncilId: "BC-KARTHIK008",
    experienceYears: 10,
    hourlyRate: 2100,
    bio: "Consumer-protection and banking disputes advocate. Recovered claims worth ₹12Cr+ for clients.",
    city: "Bengaluru",
    specializations: ["Consumer Protection", "Bankruptcy & Insolvency"],
    verified: true,
  },
];

async function main() {
  console.log("Seeding LegalFlow...");

  const passwordHash = await hash("password123", 10);

  // Ensure specializations exist
  for (const name of SPECIALIZATIONS) {
    await prisma.specialization.upsert({
      where: { name },
      update: {},
      create: { name, description: `Legal services in ${name}.` },
    });
  }

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@legalflow.example" },
    update: {},
    create: {
      name: "LegalFlow Admin",
      email: "admin@legalflow.example",
      passwordHash,
      role: UserRole.ADMIN,
      wallet: { create: { balance: 0 } },
    },
  });

  // Client
  const client = await prisma.user.upsert({
    where: { email: "client@legalflow.example" },
    update: {},
    create: {
      name: "Aarav Sharma",
      email: "client@legalflow.example",
      passwordHash,
      phone: "+91 98765 43210",
      role: UserRole.CLIENT,
      wallet: { create: { balance: 500 } },
    },
  });

  // Lawyers
  const lawyerIds: string[] = [];
  for (const l of LAWYERS) {
    const user = await prisma.user.upsert({
      where: { email: l.email },
      update: {},
      create: {
        name: l.name,
        email: l.email,
        passwordHash,
        role: UserRole.LAWYER,
        wallet: { create: { balance: 0 } },
      },
    });

    const profile = await prisma.lawyerProfile.upsert({
      where: { userId: user.id },
      update: { barCouncilId: l.barCouncilId },
      create: {
        userId: user.id,
        barCouncilId: l.barCouncilId,
        experienceYears: l.experienceYears,
        hourlyRate: l.hourlyRate,
        bio: l.bio,
        city: l.city,
        isVerified: l.verified,
        commissionRate: 12,
      },
    });
    lawyerIds.push(user.id);

    // Default weekly availability: Mon–Fri 10:00–18:00, Sat 10:00–14:00
    const existingAvailability = await prisma.availability.count({
      where: { lawyerProfileId: profile.id },
    });
    if (existingAvailability === 0) {
      const weekly = [1, 2, 3, 4, 5, 6];
      for (const day of weekly) {
        await prisma.availability.create({
          data: {
            lawyerProfileId: profile.id,
            dayOfWeek: day,
            startMinute: 10 * 60,
            endMinute: day === 6 ? 14 * 60 : 18 * 60,
          },
        });
      }
    }

    for (const specName of l.specializations) {
      const spec = await prisma.specialization.findUnique({ where: { name: specName } });
      if (!spec) continue;
      await prisma.lawyerSpecialization.upsert({
        where: {
          lawyerId_specializationId: { lawyerId: profile.id, specializationId: spec.id },
        },
        update: {},
        create: { lawyerId: profile.id, specializationId: spec.id },
      });
    }
  }

  // Demo booking + rating between client and first lawyer
  const firstLawyerId = lawyerIds[0];
  const firstProfile = await prisma.lawyerProfile.findUnique({
    where: { userId: firstLawyerId },
  });
  if (firstProfile) {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(11, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const price = firstProfile.hourlyRate;

    const existing = await prisma.booking.findFirst({
      where: { clientId: client.id, lawyerId: firstLawyerId },
    });
    const booking = existing ?? (await prisma.booking.create({
      data: {
        clientId: client.id,
        lawyerId: firstLawyerId,
        lawyerProfileId: firstProfile.id,
        title: "Family consultation",
        description: "Discussion about matrimonial property settlement.",
        startTime: start,
        endTime: end,
        status: BookingStatus.COMPLETED,
        price,
        commissionAmount: Math.round(price * 0.12 * 100) / 100,
        lawyerEarning: Math.round(price * 0.88 * 100) / 100,
        paymentProvider: "WALLET",
      },
    }));

    const ratingExists = await prisma.rating.findUnique({
      where: { bookingId: booking.id },
    });
    if (!ratingExists) {
      await prisma.rating.create({
        data: {
          bookingId: booking.id,
          clientId: client.id,
          lawyerProfileId: firstProfile.id,
          score: 5,
          comment: "Very clear advice, highly recommended.",
        },
      });
    }

    const wallet = await prisma.wallet.upsert({
      where: { userId: client.id },
      update: {},
      create: { userId: client.id, balance: 0 },
    });
    const txnExists = await prisma.transaction.findFirst({
      where: { reference: booking.id, type: TransactionType.BOOKING_PAYMENT },
    });
    if (!txnExists) {
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          userId: client.id,
          type: TransactionType.BOOKING_PAYMENT,
          amount: -price,
          description: `Consultation with ${LAWYERS[0].name}`,
          reference: booking.id,
        },
      });
    }
  }

  // Demo filled form
  const demoForm = await prisma.form.findFirst({
    where: { ownerId: client.id, title: "Rental Agreement" },
  });
  if (!demoForm) {
    const form = await prisma.form.create({
      data: {
        ownerId: client.id,
        title: "Rental Agreement",
        fileName: "rental-agreement-sample.pdf",
        fileUrl: "/uploads/demo/rental-agreement-sample.pdf",
        fileType: "application/pdf",
        status: FormStatus.FILLED,
        ocrText: "Tenant details: Aarav Sharma, MG Road Bengaluru.",
        price: 5,
        fields: {
          create: [
            { label: "Full name", value: "Aarav Sharma", confidence: 0.99, order: 1 },
            { label: "Address", value: "MG Road, Bengaluru", confidence: 0.97, order: 2 },
            { label: "Property type", value: "Apartment", confidence: 0.95, order: 3 },
            { label: "Tenure (months)", value: "12", confidence: 0.93, order: 4 },
          ],
        },
        filledData: {
          "Full name": "Aarav Sharma",
          Address: "MG Road, Bengaluru",
          "Property type": "Apartment",
          "Tenure (months)": "12",
        },
      },
    });
  }

  // Demo profile knowledge base for the client
  const profileItems: Array<{ key: string; label: string; value: string; category: string }> = [
    { key: "fullname", label: "Full name", value: "Aarav Sharma", category: "PERSONAL" },
    { key: "emailaddress", label: "Email address", value: "client@legalflow.example", category: "CONTACT" },
    { key: "phonenumber", label: "Phone number", value: "+91 98765 43210", category: "CONTACT" },
    { key: "address", label: "Address", value: "42 Lakeview Road, Indiranagar, Bengaluru 560038", category: "ADDRESS" },
    { key: "city", label: "City", value: "Bengaluru", category: "ADDRESS" },
    { key: "state", label: "State", value: "Karnataka", category: "ADDRESS" },
    { key: "pincode", label: "Pincode", value: "560038", category: "ADDRESS" },
    { key: "occupation", label: "Occupation", value: "Software Engineer", category: "EMPLOYMENT" },
    { key: "companyname", label: "Company name", value: "TechNova Pvt Ltd", category: "EMPLOYMENT" },
    { key: "education", label: "Education", value: "B.Tech Computer Science", category: "EDUCATION" },
    { key: "fathername", label: "Father name", value: "Ramesh Sharma", category: "FAMILY" },
    { key: "pannumber", label: "PAN number", value: "ABCDE1234F", category: "IDENTIFICATION" },
    { key: "maritalstatus", label: "Marital status", value: "Single", category: "FAMILY" },
  ];
  for (const it of profileItems) {
    await prisma.profileItem.upsert({
      where: { userId_key: { userId: client.id, key: it.key } },
      update: { label: it.label, value: it.value, category: it.category, approved: true },
      create: { userId: client.id, key: it.key, label: it.label, value: it.value, category: it.category, approved: true },
    });
  }

  console.log(`Done. Admin: admin@legalflow.example, Client: client@legalflow.example, lawyers: ${LAWYERS.length}`);
  console.log("All seeded accounts use password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
