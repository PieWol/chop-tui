import { ApiPromise, WsProvider } from "@polkadot/api"
import { AnyJson } from "@polkadot/types-codec/types"
import { exec } from 'child_process';
import * as readlineSync from "readline-sync"
import * as fs from 'fs';
import * as path from 'path';
import { parachains } from "@polkadot/types/interfaces/definitions";

const networkWsUrls: Record<string, string | undefined> = {
  polkadot: "wss://rpc.polkadot.io",
  kusama: "wss://kusama-rpc.polkadot.io",
}

// Declare parachainValues at the top-level scope
const parachainValues: any[] = [];

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
    // Add a variable to store parachain values
    const parachainValues: any[] = [];
    console.log("Decoded Extrinsic:", formatCall(decodedExtr))
    // display involved parachains
    console.log("ParachainIDs:", parachainValues.toString())

    startChopsticks(parachainValues)
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
      // track all parachainIDs
      if (key === "Parachain") {
        parachainValues.push(value);
      }
      console.log("current key:", key);
      console.log("current value:", value);

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

// Modify startChopsticks to accept parachainValues as an argument
function startChopsticks(parachainValues: any[]) {
  // Construct the chopsticks command based on parachainValues
  // launch the correct network for each parachainID. TODO:
  parachainValues.forEach(({ network, encodedCall }) => {
    const chopsticksCommand = `chopsticks --network ${network}  --encodedCall ${encodedCall}`;
    
    // Start chopsticks using child_process
    const child = exec(chopsticksCommand);

    // Handle child process events as needed
    child.on('exit', (code, signal) => {
      console.log(`chopsticks exited with code ${code} and signal ${signal}`);
    });

    
    // Check if stdout exists before using it
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        console.log(`chopsticks stdout: ${data}`);
      });
    }

    // Check if stderr exists before using it
    if (child.stderr) {
      child.stderr.on('data', (data) => {
        console.error(`chopsticks stderr: ${data}`);
      });
    }
  });
}
