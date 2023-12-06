import { ApiPromise, WsProvider } from "@polkadot/api"
import { AnyJson } from "@polkadot/types-codec/types"
import * as readlineSync from "readline-sync"
import * as fs from 'fs';
import * as path from 'path';

const networkWsUrls: Record<string, string | undefined> = {
  polkadot: "wss://rpc.polkadot.io",
  kusama: "wss://kusama-rpc.polkadot.io",
}

async function main() {
  const networkOptions = Object.keys(networkWsUrls)

  // Prompt the user for the network selection
  const selectedIndex = readlineSync.keyInSelect(networkOptions, "Select a network:")
  if (selectedIndex === -1) {
    console.log("Cancelled. Exiting...")
    process.exitCode = 1
    return
  }

  const selectedNetwork = networkOptions[selectedIndex]
  await getRuntimeUpgradeByProposalHash(selectedNetwork)
}

async function getRuntimeUpgradeByProposalHash(network: string) {
  const wsUrl = networkWsUrls[network]
  if (typeof wsUrl !== "string") throw new Error("Invalid network selection")

  // Ask the user for a proposal hash
  const proposalHash = readlineSync.question("Enter the proposal hash: ", {
    limit: (input) => input.length > 0,
    limitMessage: "Input a valid proposal hash, please.",
  })
  // Ask the user for the len
  const proposalLen = readlineSync.questionInt("Enter the len: ").toString()

  const api = await ApiPromise.create({ provider: new WsProvider(wsUrl) })

  try {
    const preimage = await api.query.preimage.preimageFor([proposalHash, proposalLen])
    const encodedCall = preimage.toHuman()

    // Check for null fetch
    if (encodedCall == null) {
        console.log('Could not fetch preimage. Data has been cleared or inputs were wrong.')
        return
      }

    // Display the results
    const metadata = await api.rpc.state.getMetadata()
    console.log("Metadata Version:", metadata.version.toString())

    // Decode the extrinsic using the extrinsic type
    const decodedExtr = api.createType("Call", encodedCall).toHuman()
    console.log("Decoded Extrinsic:", formatCall(decodedExtr))
  } catch (error) {
    throw new Error(`Error fetching data for proposal hash ${proposalHash}: ${String(error)}`)
  } finally {
    await api.disconnect()
  }
}

function formatCall(call: Record<string, AnyJson> | AnyJson | null, depth = 0): string {
  if (call === null || call === undefined) return ""

  return Object.entries(call)
    .map(([key, value]) => {
      // Handle arrays (e.g., nested calls)
      if (Array.isArray(value))
        return value
          .map((item) => `${" ".repeat(depth * 2)}${key}:\n${formatCall(item, depth + 1)}`)
          .join("")

      // Handle nested objects
      if (typeof value === "object")
        return `${" ".repeat(depth * 2)}${key}:\n${formatCall(value, depth + 1)}`

      // Display key-value pair
      return `${" ".repeat(depth * 2)}${key}: ${value}\n`
    })
    .join("")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })