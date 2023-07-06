import { Keypair, Connection, PublicKey, Signer } from "@solana/web3.js";
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
  toBigNumber,
} from "@metaplex-foundation/js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
} from "@solana/spl-token";
import * as fs from "fs";
import dotenv from "dotenv";
import bs58 from "bs58";
dotenv.config();

const QUICKNODE_RPC = process.env.QUICKNODE!;
const SOLANA_CONNECTION = new Connection(QUICKNODE_RPC);

//using wallet secret key, generate keypair instance
const secret = fs.readFileSync('keys/minter-Nd23uiZU6Nca1aiaViw4kkon4c7PbrtLCRSgGRYKKw5.json', 'utf-8')
const WALLET = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secret)));
console.log(WALLET.publicKey);

const METAPLEX = Metaplex.make(SOLANA_CONNECTION)
  .use(keypairIdentity(WALLET))
  .use(
    bundlrStorage({
      address: "https://devnet.bundlr.network",
      providerUrl: QUICKNODE_RPC,
      timeout: 60000,
    })
  );

const CONFIG = {
  uploadPath: "uploads/",
  imgFileName: "image.png",
  imgType: "image/png",
  imgName: "QuickNode Pixel",
  description: "Pixel infrastructure for everyone!",
  attributes: [
    { trait_type: "Speed", value: "Quick" },
    { trait_type: "Type", value: "Pixelated" },
    { trait_type: "Background", value: "QuickNode Blue" },
  ],
  sellerFeeBasisPoints: 500, //500 bp = 5%
  symbol: "QNPIX",
  creators: [{ address: WALLET.publicKey, share: 100 }],
};

async function createMintAccount(): Promise<PublicKey> {
  const mint = await createMint(
    SOLANA_CONNECTION,
    WALLET,
    WALLET.publicKey,
    null,
    0
  );

//   console.log(1)
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    SOLANA_CONNECTION,
    WALLET,
    mint,
    WALLET.publicKey
  );
//   console.log(2)

//   console.log("Mint Account", mint.toBase58());
//   console.log("Token Account:", tokenAccount);
return mint
}

async function uploadImage(
  filePath: string,
  fileName: string
): Promise<string> {
  console.log("Step 1 - Uploading Image");
  const imgBuffer = fs.readFileSync(filePath + fileName);
  const imgMetaplexFile = toMetaplexFile(imgBuffer, fileName);
  const imgUri = await METAPLEX.storage().upload(imgMetaplexFile);
  console.log(` Image URI: `, imgUri);
  return imgUri;
}

async function uploadMetadata(
  imgUri: string,
  imgType: string,
  nftName: string,
  description: string,
  attributes: { trait_type: string; value: string }[]
) {
  console.log(`Step 2 - Uploading Metadata`);
  const { uri } = await METAPLEX.nfts().uploadMetadata({
    name: nftName,
    description: description,
    image: imgUri,
    attributes: attributes,
    properties: {
      files: [
        {
          type: imgType,
          uri: imgUri,
        },
      ],
    },
  });

  console.log(" Metadata URI: ", uri);
  return uri;
}

async function mintNft(
  metadataUri: string,
  name: string,
  sellerFee: number,
  symbol: string,
  authority: Signer
) {
  console.log(`Step 3 - Minting NFT`);
  const { nft } = await METAPLEX.nfts().create({
    uri: metadataUri,
    name: name,
    sellerFeeBasisPoints: sellerFee,
    symbol: symbol,
    updateAuthority: authority,
    isMutable: false,
    maxSupply: toBigNumber(1),
  });
  console.log(`   Success!🎉`);
  console.log(
    `   Minted NFT: https://explorer.solana.com/address/${nft.address}?cluster=devnet`
  );
}

async function main() {
  const mint = await createMintAccount();

  console.log(
    `Minting ${
      CONFIG.imgName
    } to an NFT in Wallet ${WALLET.publicKey.toBase58()}`
  );

  //Step 1 - Upload Image
  const imgUri = await uploadImage(CONFIG.uploadPath, CONFIG.imgFileName);

  //Step 2 - Upload Metadata
  const metadataUri = await uploadMetadata(
    imgUri,
    CONFIG.imgType,
    CONFIG.imgName,
    CONFIG.description,
    CONFIG.attributes
  );

  //Step 3 - Mint NFT

  mintNft(
    metadataUri,
    CONFIG.imgName,
    CONFIG.sellerFeeBasisPoints,
    CONFIG.symbol,
    WALLET
  );
}

main();
