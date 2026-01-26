import path from "path";
import fs from "fs/promises";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Instrument } from "../models/Instrument";
import { Location } from "../models/Location";
import { Gig } from "../models/Gig";
import { MusicianProfile } from "../models/MusicianProfile";
import { User } from "../models/User";
import { deriveDefaultPermissions } from "./access";

function mimeTypeForFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function readSeedImages(
  dirName: string,
): Promise<Array<{ filename: string; mimeType: string; data: Buffer }>> {
  const root = process.cwd();
  const abs = path.resolve(root, "..", dirName);
  const files = await fs.readdir(abs);
  const imageFiles = files
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  const images: Array<{ filename: string; mimeType: string; data: Buffer }> =
    [];
  for (const filename of imageFiles) {
    const data = await fs.readFile(path.join(abs, filename));
    images.push({ filename, mimeType: mimeTypeForFilename(filename), data });
  }
  return images;
}

function instrumentFromFilename(filename: string): {
  name: string;
  category: string;
  dailyRate: number;
} {
  const f = filename.toLowerCase();
  if (f.includes("strat"))
    return { name: "Fender Stratocaster", category: "Guitar", dailyRate: 35 };
  if (f.includes("bass"))
    return { name: "Fender Bass", category: "Bass", dailyRate: 35 };
  if (f.includes("pearl") || f.includes("kit"))
    return { name: "Drum Kit", category: "Drums", dailyRate: 55 };
  return { name: "Instrument Rental", category: "Gear", dailyRate: 30 };
}

function locationFromFilename(filename: string): {
  name: string;
  city: string;
  address: string;
  coordinates: { lat: number; lng: number };
} {
  const f = filename.toLowerCase();

  // Map seed images to real venue data
  if (f.includes("seattle") || f.includes("stadium")) {
    return {
      name: "Lumen Field Event Center",
      city: "Seattle",
      address: "800 Occidental Ave S, Seattle, WA 98134",
      coordinates: { lat: 47.5952, lng: -122.3316 },
    };
  }
  if (f.includes("fitch") || f.includes("popup")) {
    return {
      name: "Fitch Popup Stage",
      city: "Los Angeles",
      address: "6801 Hollywood Blvd, Los Angeles, CA 90028",
      coordinates: { lat: 34.1017, lng: -118.3406 },
    };
  }
  if (f.includes("small")) {
    return {
      name: "The Mint LA",
      city: "Los Angeles",
      address: "6010 W Pico Blvd, Los Angeles, CA 90035",
      coordinates: { lat: 34.0522, lng: -118.3664 },
    };
  }

  // Fallback for unknown images
  const base = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  const name = base
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return {
    name,
    city: "Los Angeles",
    address: "6801 Hollywood Blvd, Los Angeles, CA 90028",
    coordinates: { lat: 34.1017, lng: -118.3406 },
  };
}

export async function seedDemoDataIfEnabled(): Promise<void> {
  if (process.env.SEED_DEMO_DATA !== "true") return;

  const [musiciansCount, instrumentsCount, locationsCount, gigsCount] =
    await Promise.all([
      MusicianProfile.countDocuments({}).exec(),
      Instrument.countDocuments({}).exec(),
      Location.countDocuments({}).exec(),
      Gig.countDocuments({}).exec(),
    ]);
  // Seed core demo users if they do not exist.
  const passwordHash = await bcrypt.hash("test", 10);

  async function ensureUser(params: {
    email: string;
    name: string;
    roles: string[];
  }): Promise<import("../models/User").IUser | null> {
    const existing = await User.findOne({ email: params.email }).exec();
    if (existing) return existing;

    const permissions = deriveDefaultPermissions(params.roles);
    const created = await User.create({
      name: params.name,
      email: params.email,
      passwordHash,
      roles: params.roles,
      permissions,
    });
    return created;
  }

  const adminUser = await ensureUser({
    email: "admin@admin.com",
    name: "Admin",
    roles: ["admin"],
  });

  const musicUser = await ensureUser({
    email: "music@music.com",
    name: "Music Host",
    roles: ["customer"],
  });

  const musicianUser = await ensureUser({
    email: "musician@music.com",
    name: "Demo Musician",
    roles: ["musician"],
  });

  // "Muse" account: seeded without marketplace roles so the apps
  // can guide the user into the right role/sub-app.
  const existingMuse = await User.findOne({ email: "muse@music.com" }).exec();
  if (!existingMuse) {
    await User.create({
      name: "Muse User",
      email: "muse@music.com",
      passwordHash,
      roles: [],
      permissions: [],
    });
  }

  if (musiciansCount === 0) {
    const profiles: Parameters<typeof MusicianProfile.create>[0] = [
      {
        userId: musicianUser ? String(musicianUser.id) : undefined,
        instruments: ["DJ"],
        genres: ["House", "Pop"],
        bio: "High-energy open-format DJ for clubs and private events.",
        averageRating: 4.9,
        reviewCount: 212,
        defaultHourlyRate: 150,
        acceptsDirectRequests: true,
      },
      {
        instruments: ["Vocals", "Piano"],
        genres: ["Jazz", "Soul"],
        bio: "Elegant background sets for dinners and hotel lounges.",
        averageRating: 4.7,
        reviewCount: 96,
        defaultHourlyRate: 120,
        acceptsDirectRequests: true,
      },
    ];
    await MusicianProfile.create(profiles as any);
  }

  // Instruments + instrument images
  {
    const seedImages = await readSeedImages("seed-instrument-images");

    if (instrumentsCount === 0) {
      const docs = seedImages.length
        ? seedImages.map((img) => {
            const meta = instrumentFromFilename(img.filename);
            return {
              name: meta.name,
              category: meta.category,
              dailyRate: meta.dailyRate,
              available: true,
              images: [img],
            };
          })
        : [
            {
              name: "Fender Stratocaster",
              category: "Guitar",
              dailyRate: 35,
              available: true,
              images: [],
            },
          ];
      await Instrument.create(docs);
    } else if (seedImages.length) {
      for (const img of seedImages) {
        const meta = instrumentFromFilename(img.filename);
        const existing = await Instrument.findOne({ name: meta.name }).exec();
        if (!existing) {
          await Instrument.create({
            name: meta.name,
            category: meta.category,
            dailyRate: meta.dailyRate,
            available: true,
            images: [img],
          });
          continue;
        }

        const images = (existing as any).images ?? [];
        if (Array.isArray(images) && images.length === 0) {
          (existing as any).images = [img];
          await existing.save();
        }
      }
    }
  }

  // Locations + location images
  {
    const seedImages = await readSeedImages("seed-gig-location-images");

    if (locationsCount === 0) {
      const docs = seedImages.map((img) => {
        const meta = locationFromFilename(img.filename);
        return {
          name: meta.name,
          city: meta.city,
          address: meta.address,
          coordinates: meta.coordinates,
          images: [img],
        };
      });
      if (docs.length) await Location.create(docs);
    } else if (seedImages.length) {
      for (const img of seedImages) {
        const meta = locationFromFilename(img.filename);
        const existing = await Location.findOne({ name: meta.name }).exec();
        if (!existing) {
          await Location.create({
            name: meta.name,
            city: meta.city,
            address: meta.address,
            coordinates: meta.coordinates,
            images: [img],
          });
          continue;
        }
        const images = (existing as any).images ?? [];
        if (Array.isArray(images) && images.length === 0) {
          (existing as any).images = [img];
          await existing.save();
        }
      }
    }

    // Ensure the host account has a few stage listings with real images
    // so the host dashboard looks like a real product demo.
    if (musicUser && seedImages.length) {
      const desired = Math.min(3, seedImages.length);
      const hostId = new mongoose.Types.ObjectId(musicUser.id);
      const existingHostStages = await Location.countDocuments({
        createdByUserId: hostId,
      }).exec();

      if (existingHostStages < 2) {
        const picks = seedImages.slice(0, desired);
        for (const img of picks) {
          const meta = locationFromFilename(img.filename);
          const already = await Location.findOne({
            name: meta.name,
            createdByUserId: hostId,
          }).exec();
          if (already) continue;

          // Avoid stealing ownership of a shared seeded location; create a host-owned copy.
          await Location.create({
            name: meta.name,
            city: meta.city,
            address: meta.address,
            coordinates: meta.coordinates,
            createdByUserId: hostId,
            images: [img],
          });
        }
      }
    }
  }

  // Ensure the host has multiple gigs attached to a real stage/location.
  if (musicUser) {
    const hostId = new mongoose.Types.ObjectId(musicUser.id);
    const hostLocations = await Location.find({ createdByUserId: hostId })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    const fallbackLocation = await Location.findOne({})
      .sort({ createdAt: -1 })
      .exec();

    const pickLocationId =
      (hostLocations[0]?.id ?? fallbackLocation?.id)
        ? new mongoose.Types.ObjectId(
            (hostLocations[0]?.id ?? fallbackLocation?.id) as string,
          )
        : undefined;

    const existingHostGigs = await Gig.countDocuments({
      createdByUserId: hostId,
    }).exec();

    if (existingHostGigs < 2 && pickLocationId) {
      // Job postings for musicians (not shown on public concert page)
      const jobPostings = [
        {
          title: "Need a DJ for a small event",
          description: "Open-format DJ, 2 hours, bring basic controller.",
          date: "2026-02-01",
          time: "20:00",
          budget: 600,
          gigType: "musician-wanted" as const,
        },
        {
          title: "Jazz trio for dinner service",
          description: "Background sets, 3 hours, venue provides piano.",
          date: "2026-02-10",
          time: "18:30",
          budget: 900,
          gigType: "musician-wanted" as const,
        },
      ];

      for (const t of jobPostings) {
        const exists = await Gig.findOne({
          createdByUserId: hostId,
          title: t.title,
        }).exec();
        if (exists) continue;
        await Gig.create({
          ...t,
          locationId: pickLocationId,
          createdByUserId: hostId,
          status: "open",
        });
      }
    }
  }

  // Seed public concerts for the Music marketplace
  {
    const adminUserForConcerts =
      adminUser ?? (await User.findOne({ roles: "admin" }).exec());
    if (!adminUserForConcerts) return;

    const concertHostId = new mongoose.Types.ObjectId(adminUserForConcerts.id);
    const existingConcerts = await Gig.countDocuments({
      gigType: "public-concert",
    }).exec();

    if (existingConcerts < 3) {
      const allLocations = await Location.find({}).limit(10).exec();

      const publicConcerts = [
        {
          title: "Friday Night Jazz",
          description:
            "Unwind with smooth jazz from the city's finest quartet. Full bar and appetizers available.",
          date: "2026-02-07",
          time: "19:30",
          ticketPrice: 25,
          openForTickets: true,
        },
        {
          title: "Acoustic Sessions: Singer-Songwriter Showcase",
          description:
            "An intimate evening featuring three local singer-songwriters sharing original music.",
          date: "2026-02-14",
          time: "20:00",
          ticketPrice: 15,
          openForTickets: true,
        },
        {
          title: "Latin Dance Night",
          description:
            "Live salsa band with dance floor. Beginner lesson at 7pm, band starts at 8pm.",
          date: "2026-02-21",
          time: "19:00",
          ticketPrice: 20,
          openForTickets: true,
        },
        {
          title: "Classical Piano Recital",
          description:
            "Award-winning pianist performs Chopin, Debussy, and Rachmaninoff. Reserved seating.",
          date: "2026-02-28",
          time: "18:00",
          ticketPrice: 35,
          openForTickets: true,
        },
        {
          title: "Blues & Brews",
          description:
            "Electric blues trio paired with local craft beer tasting. 21+ event.",
          date: "2026-03-07",
          time: "20:30",
          ticketPrice: 30,
          openForTickets: true,
        },
        {
          title: "Sunday Brunch Concert",
          description:
            "Live acoustic duo while you enjoy brunch. Family-friendly, all ages welcome.",
          date: "2026-03-08",
          time: "11:00",
          ticketPrice: 0,
          openForTickets: false,
        },
      ];

      for (let i = 0; i < publicConcerts.length; i++) {
        const c = publicConcerts[i];
        const exists = await Gig.findOne({
          title: c.title,
          gigType: "public-concert",
        }).exec();
        if (exists) continue;

        const loc = allLocations[i % allLocations.length];
        await Gig.create({
          ...c,
          gigType: "public-concert",
          locationId: loc
            ? new mongoose.Types.ObjectId(loc.id as string)
            : undefined,
          createdByUserId: concertHostId,
          status: "open",
        });
      }
    }
  }
}
