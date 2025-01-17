import { TypedEmitter } from 'tiny-typed-emitter'

import { nSysNode } from "../Node";
import { nSysPlayer } from '../Player';

import { ManagerEvents } from './interface';

import { lavalinkLoadtracks, NodeConfig, payloadData } from '../Node/interface'
import { VoiceUpdate } from "../Player/interface";

export class nSysManager extends TypedEmitter<ManagerEvents> {
    public readonly nodes: Map<string, nSysNode>
    public userId: string | null = null

    constructor(nodes: NodeConfig[]) {
        super();
        this.nodes = new Map<string, nSysNode>(
            nodes.map(node => (
                [
                    node?.name ?? node?.host,
                    new nSysNode(node, this)
                ]
            ))
        );
    }

    handleVoiceUpdate(update: VoiceUpdate): void {
        const node = Array.from(this.nodes.values()).find(node => node.players.get(update?.guild_id));
        if (node) node.handleVoiceUpdate(update)
    }

    connect(userId: string): void {
        this.userId = userId;
        Array.from(this.nodes.values()).forEach(node => 
            node.connect(userId)
        );
    }

    createPlater(guildId: string): nSysPlayer | null {
        const node = Array.from(this.nodes.values()).filter(node => node.isConnected && node.play).sort((a, b) => a.players.size - b.players.size).reverse().at(0);
        if (!node) return null;
        return node.createPlater(guildId);
    }

    getPlayer(guildId: string): nSysPlayer | null | undefined {
        const node = Array.from(this.nodes.values()).find(node => Array.from(node.players.values()).find(player => player.guildId === guildId));
        if (!node) return null;
        return node.getPlayer(guildId);
    }

    async destroyPlayer(guildId: string): Promise<boolean> {
        const node = Array.from(this.nodes.values()).find(node => Array.from(node.players.values()).find(player => player.guildId === guildId));
        if (!node) return false;
        const player = node.getPlayer(guildId);
        if (!player) return false
        player.disconnect();
        await player.destroy();
        node.destroyPlayer(player.guildId);
        return true;
    }

    getNode(name: string): nSysNode | undefined {
        return this.nodes.get(name)
    }

    addNode(nodeConfig: NodeConfig): nSysNode {
        const node = new nSysNode(nodeConfig, this);
        this.nodes.set(node.name, node);
        return node;
    }

    deleteNode(name: string): boolean {
        const node = this.nodes.get(name);
        if (!node) return false;
        this.nodes.delete(node.name);
        return true;
    }

    async loadTracks(search: string): Promise<lavalinkLoadtracks> {
        const nodes = Array.from(this.nodes.values()).filter(node => node.isConnected && node.search);
        let node = nodes.find(Boolean)
        if (!node) return {
            loadType: 'LOAD_FAILED',
            playlistInfo: {},
            tracks: []
        }
        return node.loadTracks(search);
    }
}