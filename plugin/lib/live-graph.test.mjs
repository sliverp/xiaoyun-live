import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {LIVE_STATES,planLiveTurn} from './live-state.js'

const source=readFileSync(new URL('./client.js',import.meta.url),'utf8').split('// BEGIN LIVE STATE GRAPH')[1].split('// END LIVE STATE GRAPH')[0]
const project=runInNewContext(source+'\nliveGraphModel')
function machine(id,nextId) {
  return {current:LIVE_STATES.find(node=>node.id===id),next:{id:nextId,condition:'整段播放完成'},nodes:LIVE_STATES,
    metrics:{engagementMinTurns:5,engagementCooldownSeconds:150},
    transitions:planLiveTurn({openingPending:false,closingRequested:false,bridgeReady:true,pageReady:true,frequency:60,unreadCount:1,sourceSinceComment:1,commentElapsedMs:0,sourceFinished:false,engagementPending:false,navigationPending:false}).rules}
}

test('the ready graph shows all stages and highlights only the actual current node and its next path',()=>{
  const graph=project(machine('idle','opening'))
  assert.equal(graph.nodes.length,14)
  assert.deepEqual(Array.from(graph.nodes.filter(node=>node.current),node=>node.id),['idle'])
  assert.deepEqual(Array.from(graph.nodes.filter(node=>node.next),node=>node.id),['opening'])
  assert.deepEqual(Array.from(graph.edges.filter(edge=>edge.next),edge=>edge.key),['idle:opening'])
})

test('the giveaway path shows announcement, timed participation, and result before returning to scheduling',()=>{
  for(const [current,next]of [['scheduling','lottery-announcement'],['lottery-announcement','lottery-wait'],['lottery-wait','lottery-result'],['lottery-result','scheduling']]){
    const graph=project(machine(current,next))
    assert.equal(graph.nextId,next)
    assert.deepEqual(Array.from(graph.edges.filter(edge=>edge.next),edge=>edge.key),[current+':'+next])
  }
})

test('narration must return to scheduling before a comment or an interaction is chosen',()=>{
  const graph=project(machine('source','scheduling'))
  assert.deepEqual(Array.from(graph.edges.filter(edge=>edge.next),edge=>edge.key),['source:scheduling'])
  assert.equal(graph.edges.find(edge=>edge.key==='scheduling:comment').next,false)
  assert.match(graph.edges.find(edge=>edge.key==='scheduling:comment').condition,/1 段或距上次回应 51 秒/)
  assert.match(graph.edges.find(edge=>edge.key==='scheduling:engagement').condition,/5 段讲解和 150 秒/)
})

test('goodbye points to ended instead of showing a new narration round',()=>{
  const graph=project(machine('closing','scheduling'))
  assert.equal(graph.nextId,'ended')
  assert.deepEqual(Array.from(graph.edges.filter(edge=>edge.next),edge=>edge.key),['closing:ended'])
  assert.match(graph.nextCondition,/停止人声和背景音乐/)
})

test('page confirmation and recovered connections visibly return to the decision point',()=>{
  for(const [id,nextId] of [['advancing','waiting'],['waiting','source']]) {
    const graph=project(machine(id,nextId))
    assert.equal(graph.nextId,'scheduling')
    assert.deepEqual(Array.from(graph.edges.filter(edge=>edge.next),edge=>edge.key),[id+':scheduling'])
  }
  const paused=project(machine('waiting','waiting'))
  assert.equal(paused.nextId,'waiting')
  assert.equal(paused.edges.filter(edge=>edge.next).length,0)
})

test('the graph is renderable without mutating a server snapshot',()=>{
  const snapshot=machine('error','opening')
  const saved=JSON.stringify(snapshot)
  const graph=project(snapshot)
  assert.equal(JSON.stringify(snapshot),saved)
  assert.equal(graph.edges.find(edge=>edge.key==='error:opening').next,true)
  for(const edge of graph.edges){assert.ok(graph.nodes.some(node=>node.id===edge.from));assert.ok(graph.nodes.some(node=>node.id===edge.to));assert.ok(edge.condition)}
})


test('hourly sale mode replaces the giveaway chain with an independent overlay node',()=>{
 const snapshot=machine('scheduling','flash-sale');snapshot.flashSale={configured:true,config:{enabled:true}};
 const graph=project(snapshot);
 assert.ok(graph.nodes.some(node=>node.id==='flash-sale'));
 assert.ok(graph.nodes.every(node=>!node.id.startsWith('lottery-')));
 assert.equal(graph.edges.find(edge=>edge.key==='scheduling:flash-sale').next,true);
 assert.match(graph.edges.find(edge=>edge.key==='flash-sale:scheduling').condition,/翻页/);
})
