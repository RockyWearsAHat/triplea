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
  dirName: string
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
} {
  const base = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  const name = base
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  const city = filename.toLowerCase().includes("seattle") ? "Seattle" : "";
  return { name, city };
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

  const existingTest = await User.findOne({ email: "test@test.com" }).exec();
  if (!existingTest) {
    const passwordHash = await bcrypt.hash("test", 10);
    const roles = ["customer"];
    const permissions = deriveDefaultPermissions(roles);
    await User.create({
      name: "Test Customer",
      email: "test@test.com",
      passwordHash,
      roles,
      permissions,
    });
  }

  if (musiciansCount === 0) {
    await MusicianProfile.create([
      {
        instruments: ["DJ"],
        genres: ["House", "Pop"],
        bio: "High-energy open-format DJ for clubs and private events.",
        averageRating: 4.9,
        reviewCount: 212,
      },
      {
        instruments: ["Vocals", "Piano"],
        genres: ["Jazz", "Soul"],
        bio: "Elegant background sets for dinners and hotel lounges.",
        averageRating: 4.7,
        reviewCount: 96,
      },
    ]);
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

  if (gigsCount === 0) {
    const testUser = await User.findOne({ email: "test@test.com" }).exec();
    const location = await Location.findOne({}).sort({ createdAt: -1 }).exec();
    if (testUser) {
      await Gig.create({
        title: "Need a DJ for a small event",
        description: "Open-format DJ, 2 hours, bring basic controller.",
        date: "2026-02-01",
        time: "20:00",
        budget: 600,
        locationId: location
          ? new mongoose.Types.ObjectId(location.id)
          : undefined,
        createdByUserId: new mongoose.Types.ObjectId(testUser.id),
        status: "open",
      });
    }
  }
}
