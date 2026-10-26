// One-off: points the two sample characters' imageUrl at the community media-kit
// Google Drive files directly (they're shared "anyone with the link can view", and
// https://lh3.googleusercontent.com/d/{fileId}=w500 serves them without auth) rather
// than downloading/self-hosting a copy. Much less work per character, at the cost of
// depending on a third-party Drive folder staying up and public.
import "dotenv/config";
import { prisma } from "../src/prisma.js";

const driveImage = (fileId: string) => `https://lh3.googleusercontent.com/d/${fileId}=w500`;

async function main() {
  await prisma.character.update({
    where: { code: 1 }, // Jackie — CharactER/001. Jackie/02. Default/Jackie_Mini_00.png
    data: { imageUrl: driveImage("1Dk0_ql9iIHJSr2iS36xSrM9J_r_mjoGF") },
  });
  await prisma.character.update({
    where: { code: 4 }, // Magnus — CharactER/004. Magnus/02. Default/Full_Magnus_00.png
    data: { imageUrl: driveImage("105jO22OxgEwymYGeChf8VS1gooMHRGRr") },
  });
  console.log("Set imageUrl for Jackie (code 1) and Magnus (code 4) to direct Drive links.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
