"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.node = void 0;
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const config_1 = require("../config");
async function node(nodeId, // the ID of the node
N, // total number of nodes in the network
F, // number of faulty nodes in the network
initialValue, // initial value of the node
isFaulty, // true if the node is faulty, false otherwise
nodesAreReady, // used to know if all nodes are ready to receive requests
setNodeIsReady // this should be called when the node is started and ready to receive requests
) {
    const node = (0, express_1.default)();
    node.use(express_1.default.json());
    node.use(body_parser_1.default.json());
    let killed = false;
    let x = "?";
    let decided = null;
    let k = 0;
    // 1
    node.get("/status", (req, res) => {
        if (!isFaulty) {
            console.log(isFaulty);
            res.status(200).send('live');
        }
        else {
            res.status(500).send('faulty');
        }
    });
    node.get('/getState', (req, res) => {
        const node_state = {
            killed: killed, // this is used to know if the node was stopped by the /stop route. It's important for the unit tests but not very relevant for the Ben-Or implementation
            x: x, // the current consensus value
            decided: decided, // used to know if the node reached finality
            k: k, // current step of the node
        };
        res.status(201).json(node_state);
    });
    // TODO implement this
    // this route allows the node to receive messages from other nodes
    // node.post("/message", (req, res) => {});
    // TODO implement this
    // this route is used to start the consensus algorithm
    // node.get("/start", async (req, res) => {});
    // TODO implement this
    // this route is used to stop the consensus algorithm
    // node.get("/stop", async (req, res) => {});
    // TODO implement this
    // get the current state of a node
    // node.get("/getState", (req, res) => {});
    // start the server
    const server = node.listen(config_1.BASE_NODE_PORT + nodeId, async () => {
        console.log(`Node ${nodeId} is listening on port ${config_1.BASE_NODE_PORT + nodeId}`);
        // the node is ready
        setNodeIsReady(nodeId);
    });
    return server;
}
exports.node = node;
