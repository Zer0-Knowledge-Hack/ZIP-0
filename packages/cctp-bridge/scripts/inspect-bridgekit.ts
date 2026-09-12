import { BridgeKit } from "@circle-fin/bridge-kit";

const kit = new BridgeKit();
const arbSepolia: any = kit.getSupportedChains().find((c: any) => c.chain === "Arbitrum_Sepolia");
const fuji: any = kit.getSupportedChains().find((c: any) => c.chain === "Avalanche_Fuji");

console.log("Arbitrum Sepolia Forwarder:", arbSepolia?.cctp?.forwarderSupported);
console.log("Fuji Forwarder:", fuji?.cctp?.forwarderSupported);
