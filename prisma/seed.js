import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding beauty salon demo data...');

  // Admin user
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@salon.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@salon.com',
      password: adminPassword,
      active: true,
    },
  });
  console.log('Admin user:', admin.email);

  // Services
  const services = [
    { name: 'Corte Feminino',       description: 'Corte de cabelo feminino',             durationMin: 60,  price: 80.00  },
    { name: 'Corte Masculino',      description: 'Corte de cabelo masculino',             durationMin: 30,  price: 50.00  },
    { name: 'Coloracao',            description: 'Coloracao completa de cabelo',          durationMin: 120, price: 200.00 },
    { name: 'Manicure',             description: 'Manicure completa',                     durationMin: 45,  price: 40.00  },
    { name: 'Escova Progressiva',   description: 'Escova progressiva profissional',       durationMin: 180, price: 350.00 },
  ];

  const createdServices = {};
  for (const svc of services) {
    const created = await prisma.service.upsert({
      where: { id: (await prisma.service.findFirst({ where: { name: svc.name } }))?.id ?? '00000000-0000-0000-0000-000000000000' },
      update: {},
      create: svc,
    });
    createdServices[svc.name] = created;
    console.log('Service:', created.name);
  }

  // Professionals
  const professionalsData = [
    { name: 'Ana Silva',      email: 'ana@salon.com',    phone: '11900000001', active: true },
    { name: 'Carlos Oliveira', email: 'carlos@salon.com', phone: '11900000002', active: true },
    { name: 'Maria Santos',   email: 'maria@salon.com',  phone: '11900000003', active: true },
  ];

  const createdProfessionals = {};
  for (const prof of professionalsData) {
    // Upsert by email
    let existing = await prisma.professional.findFirst({ where: { email: prof.email } });
    let created;
    if (existing) {
      created = existing;
    } else {
      created = await prisma.professional.create({ data: prof });
    }
    createdProfessionals[prof.name] = created;
    console.log('Professional:', created.name);
  }

  // Professional-service assignments
  const assignments = [
    { professional: 'Ana Silva',       service: 'Corte Feminino'     },
    { professional: 'Ana Silva',       service: 'Coloracao'          },
    { professional: 'Ana Silva',       service: 'Escova Progressiva' },
    { professional: 'Carlos Oliveira', service: 'Corte Masculino'    },
    { professional: 'Maria Santos',    service: 'Manicure'           },
    { professional: 'Maria Santos',    service: 'Corte Feminino'     },
  ];

  for (const { professional, service } of assignments) {
    const prof = createdProfessionals[professional];
    const svc = createdServices[service];
    await prisma.professionalService.upsert({
      where: {
        professionalId_serviceId: {
          professionalId: prof.id,
          serviceId: svc.id,
        },
      },
      update: {},
      create: {
        professionalId: prof.id,
        serviceId: svc.id,
      },
    });
    console.log(`Assignment: ${professional} -> ${service}`);
  }

  // Working hours: Mon-Fri 09:00-18:00 (1-5), Sat 09:00-14:00 (6)
  const weekdayHours = [
    { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }, // Monday
    { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' }, // Tuesday
    { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' }, // Wednesday
    { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' }, // Thursday
    { dayOfWeek: 5, startTime: '09:00', endTime: '18:00' }, // Friday
    { dayOfWeek: 6, startTime: '09:00', endTime: '14:00' }, // Saturday
  ];

  for (const prof of Object.values(createdProfessionals)) {
    for (const hours of weekdayHours) {
      await prisma.workingHours.upsert({
        where: {
          professionalId_dayOfWeek_startTime: {
            professionalId: prof.id,
            dayOfWeek: hours.dayOfWeek,
            startTime: hours.startTime,
          },
        },
        update: {},
        create: {
          professionalId: prof.id,
          ...hours,
        },
      });
    }
    console.log(`Working hours set for: ${prof.name}`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
