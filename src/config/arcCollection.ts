/**
 * Arc Collection Configuration
 * 
 * This file defines the collection of Arc NFTs that users can mint.
 * Each NFT has:
 * - id: Unique identifier
 * - name: Display name
 * - description: Description of the NFT
 * - image: Path to the image file in public/arc-nfts/
 * - tokenURI: URL to the metadata JSON (ERC-721 standard)
 * 
 * TODO: Replace the tokenURI placeholders with actual hosted metadata URLs
 * The metadata JSON should follow ERC-721 standard:
 * {
 *   "name": "Arc Genesis #1",
 *   "description": "Primeiro NFT oficial da coleção Arc na testnet.",
 *   "image": "https://YOUR-HOSTED-URL/arc-nfts/arc1.png"
 * }
 */

export type ArcNFTItem = {
  id: number;
  name: string;
  description: string;
  image: string;    // Path to image in public/arc-nfts/
  tokenURI: string; // URL to metadata JSON (ERC-721 standard)
};

// Helper function to get absolute URL for metadata
function getMetadataURL(filename: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/metadata/${filename}`
  }
  // Fallback for SSR - use localhost in dev, or update with production URL
  const isDev = import.meta.env.DEV
  if (isDev) {
    return `http://localhost:3000/metadata/${filename}`
  }
  // Production URL - UPDATE THIS with your actual deployment URL
  return `https://your-app-domain.com/metadata/${filename}`
}

// Helper function to get absolute URL for images in metadata JSON
// This is used when generating metadata dynamically
export function getImageURL(imagePath: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${imagePath}`
  }
  const isDev = import.meta.env.DEV
  if (isDev) {
    return `http://localhost:3000${imagePath}`
  }
  // Production URL - UPDATE THIS with your actual deployment URL
  return `https://your-app-domain.com${imagePath}`
}

export const ARC_COLLECTION: ArcNFTItem[] = [
  {
    id: 1,
    name: "Arc Explorer",
    description: "A brave explorer discovering the Arc Network. The Explorer represents the pioneers who venture into the future of deterministic finality.",
    image: "/assets/nfts/arc_explorer.png",
    tokenURI: getMetadataURL("arc-explorer.json")
  },
  {
    id: 2,
    name: "Arc Builder",
    description: "A builder creating the future on Arc Network. The Builder represents developers who build innovative dApps on Arc's stable infrastructure.",
    image: "/assets/nfts/arc_builder.png",
    tokenURI: getMetadataURL("arc-builder.json")
  },
  {
    id: 3,
    name: "Arc Guardian",
    description: "A guardian protecting the Arc ecosystem. The Guardian represents the security and stability that Arc Network provides.",
    image: "/assets/nfts/arc_guardian.png",
    tokenURI: getMetadataURL("arc-guardian.json")
  },
  {
    id: 4,
    name: "Arc Genesis #4",
    description: "Quarto NFT da coleção Arc. Representa a comunidade e colaboração na Arc Testnet.",
    image: "/arc-nfts/arc4.png",
    tokenURI: getMetadataURL("arc4.json")
  },
  {
    id: 5,
    name: "Arc Genesis #5",
    description: "Quinto e último NFT da coleção Arc Genesis. Marca o futuro promissor da Arc Network.",
    image: "/arc-nfts/arc5.png",
    tokenURI: getMetadataURL("arc5.json")
  }
];












