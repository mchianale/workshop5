import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value } from "../types";
import http from "http";

// 1
type NodeState = {
  killed: boolean; // this is used to know if the node was stopped by the /stop route. It's important for the unit tests but not very relevant for the Ben-Or implementation
  x: 0 | 1 | "?" | null; // the current consensus value
  decided: boolean | null; // used to know if the node reached finality
  k: number | null; // current step of the node
};

export async function node(
    nodeId: number, // the ID of the node
    N: number, // total number of nodes in the network
    F: number, // number of faulty nodes in the network
    initialValue: Value, // initial value of the node
    isFaulty: boolean, // true if the node is faulty, false otherwise
    nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
    setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());
  const nodes_ids = [...Array(N)].map((_, index) => index);;

  const initialState: NodeState = {
    killed: false,
    x: isFaulty ? null : initialValue,
    decided: isFaulty ? null : false,
    k: isFaulty ? null : 0,
  };

  const currentState: NodeState = initialState;
  const getMessages: any[] = [];
  const propositions:  Map<number, Value[]> = new Map();
  let decisions: Map<number, Value[]> = new Map();
  // 1
  node.get("/status", (req, res) => {
    if (!isFaulty) {
      res.status(200).send("live");
    } else {
      res.status(500).send("faulty");
    }
  });

  node.get('/getState', (req, res) => {
    res.status(201).json(currentState);
  });

  // this route allows the node to receive messages from other nodes
  node.post("/message", (req, res) => {
    let { k, x, messageType } = req.body;
    if (isFaulty) {
      currentState.k = null;
      currentState.x = null;
      currentState.decided = null;
      return res.status(500).json({message : `Node ${nodeId} is faulty`})
    }
    if (currentState.killed) {return res.status(500).json({message : `Node ${nodeId} is killed`})}

      if (messageType == "decision") {
        if (!propositions.has(k)) {
          propositions.set(k, []);
        }
        propositions.get(k)!.push(x);
        let proposition = propositions.get(k)!;
        if (proposition.length >= (N - F)) {
          let n0 = proposition.filter((el) => el == 0).length;
          let n1 = proposition.filter((el) => el == 1).length;
          if (n0 > (N / 2)) {
            x = 0;
          } else if (n1 > (N / 2)) {
            x = 1;
          } else {
            x = "?";
          }
          for (let i = 0; i < N; i++) {
            postDecision(`http://localhost:${BASE_NODE_PORT + i}/message`, { k: k, x: x, messageType: "final" });
          }
          return res.status(200).json({message : "Phase 0 completed"});
        }
      }
    if (!decisions.has(k)) {
      decisions.set(k, []);
    }
      else if (messageType == "final") {
      decisions.get(k)!.push(x);
        let decision = decisions.get(k)!;
        if (decision.length >= (N - F)) {
          let n0 = decision.filter((el) => el == 0).length;
          let n1 = decision.filter((el) => el == 1).length;
          if (n1 >= F + 1 || n0 >= F + 1) {
            if (n1 >= n0) {currentState.x = 1;}
            else {currentState.x = 0;}
            currentState.decided = true;
          }
          else {
            if (n0 + n1 !== 0 && n0 > n1) {
              currentState.x = 0;
            }
            else if (n0 + n1 !== 0 && n0 < n1) {
              currentState.x = 1;
            }
            else {
              currentState.x = Math.random() > 0.5 ? 0 : 1;
            }
            currentState.k  = k + 1;

            for (let i = 0; i < N; i++) {
              postDecision(`http://localhost:${BASE_NODE_PORT + i}/message`, { k: currentState.k, x: currentState.x, messageType: "decision" });
            }
            return res.status(200).json({message : "Phase 1 completed"});
          }
        }
      }

    return res.status(500).json({message : `Issue with Node ${nodeId}`})

  });

  function postDecision(url: string, body: any) {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const contentType = res.headers['content-type'];
          if (contentType && contentType.includes('application/json')) {
            const jsonData = JSON.parse(data);
          }
        } catch (error) {}
      });
    });
    req.on('error', (error) => {});
    req.write(JSON.stringify(body));
    req.end();
  }
  // this route is used to start the consensus algorithm
  node.get("/start", async (req, res) => {
    // Implement Ben-Or consensus algorithm here
    // This involves sending messages to other nodes and updating the node's state
    // based on the messages received
    // You'll also need to handle the termination condition and set 'decided' accordingly
    let try_counter = 0
    while (!nodesAreReady()) {
      try_counter += 1;
    }
    if (isFaulty) {
      currentState.k = null;
      currentState.x = null;
      currentState.decided = null;
      return res.status(500).json({message : `Node ${nodeId} is faulty`})
    }
    currentState.k = 1;
    currentState.x = initialValue;
    currentState.decided = false;
    for (let i = 0; i < N; i++) {
      postDecision(`http://localhost:${BASE_NODE_PORT + i}/message`, { k: currentState.k, x: currentState.x, messageType: "decision" });
    }
    return res.status(200).send("Consensus algorithm started.");
  });

  // this route is used to stop the consensus algorithm
  node.get("/stop", async (req, res) => {
    currentState.killed = true;
    res.status(200).send(`Stop Node ${nodeId}`);
  });

  // start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
        `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );

    // the node is ready
    setNodeIsReady(nodeId);
  });

  return server;
}
