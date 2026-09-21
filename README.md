# Long Rope Mode Lab

大縄跳びの縄を **XPBD (Extended Position Based Dynamics)** で実際に物理シミュレーションし、
左右の回し手の回転周波数・位相差・縄の物性を変えたときに
**Double Loop / Triple Loop などの多重ループ(空間モード)が成立するか**を検証する
ブラウザ実験アプリです。

> A 3D physics experiment for exploring multi-loop modes in long-rope jumping.
> The rope is a real particle-based XPBD simulation — multi-loop states are
> measured, not scripted.

**重要:** 「MODE 3」を選ぶと3ループが描画されるような演出は一切ありません。
モード解析・節検出・周波数スイープはすべて生の物理シミュレーション結果に対して行われます。

---

## 実行方法 / Getting started

[Bun](https://bun.sh) が必要です(Node.js でも `npm` / `npx` で同等に動きます)。

```bash
bun install
bun run dev        # http://localhost:5173
```

本番ビルド(静的ファイルのみ、`dist/` に出力):

```bash
bun run build
bun run preview    # ローカルでビルド結果を確認
```

テスト / 型チェック:

```bash
bun run test        # vitest — 物理・解析の数値テスト
bun run typecheck   # tsc --noEmit
```

## デプロイ / Deploy

### Cloudflare Pages

GitHub リポジトリを接続し、以下を設定するだけです:

| 項目 | 値 |
|---|---|
| Build command | `bun run build` |
| Build output directory | `dist` |
| Root directory | (リポジトリ直下) |

サーバー・Functions・データベースは一切不要です。全計算はブラウザ内で実行されます。

### GitHub Pages

`vite.config.ts` で `base: "./"` にしているため、サブパス配信でも動きます。
Actions で `bun run build` → `dist/` を Pages に公開すればそのまま使えます。

## 使い方 / Controls

### 基本操作

| 操作 | 内容 |
|---|---|
| Space | Pause / Resume |
| R | Reset(現在のパラメータで初期状態に戻す) |
| 1 / 2 / 3 | Normal / Double Loop / Triple Search プリセット |
| 左ドラッグ / 右ドラッグ / ホイール | カメラ回転 / 平行移動 / ズーム |
| 3D · Side · Top · Front | カメラ視点プリセット |

### Drive(回し手)

両端の手は **YZ 平面内の円運動** としてモデル化しています:

```
左端:  Y = Y0 + R·cos(ωt),        Z = R·sin(ωt)
右端:  Y = Y0 + R·cos(ωt + φ),    Z = R·sin(ωt + φ)     (φ = Phase差)
```

- **Frequency** — 回転周波数 (0–5 Hz)。「左右別周波数」で左右個別にも設定可
- **Phase差** — 右手の位相オフセット。180° で逆位相(ダブルダッチ的駆動)
- **Radius** — 手の回転半径
- **回転方向** — 左右それぞれ正転/逆転

### Rope(縄)

- Length / Particles / Mass(変更すると自動リセット)
- Damping(速度減衰)、Air drag(2次空気抵抗/線密度)
- Compliance(XPBD コンプライアンス、0 = 非伸縮)
- Bending stiffness(屈曲剛性、第二近接粒子間のソフト距離制約で近似)

### World / Analysis

- Gravity、Simulation speed、Solver iterations
- 解析 ON/OFF、最大モード次数、節検出、軌跡(中点トレイル)
- **Frequency Sweep** — 指定範囲を自動掃引。各周波数で過渡応答が落ち着くまで
  `settle` 秒待ってから `measure` 秒間モード振幅を平均し、
  「最もターゲットモードが励起される周波数」をグラフ付きで表示します

### Config の共有

- **Export / Import** — 全パラメータを JSON で保存・復元
- **🔗 Share** — パラメータを URL ハッシュ(`#c=...`)に埋め込んでコピー。
  開くだけで同じ条件を再現できます
- **● Rec** — dominant mode / purity / 節数などの時系列を CSV で保存

---

## モード解析の方法 / Mode analysis

「見た目で3ループっぽい」ではなく、数値的に空間モードを推定しています。

1. 両端点を結ぶ直線を基準線とし、その垂直平面内の各粒子の横変位
   `u_i = (u1_i, u2_i)` を計算(Y・Z 両成分を含む。縄全体が回転しても壊れない)
2. 各粒子について変位の緩やかな時間平均(EMA, τ≈2.5 s)を引き、
   静止したたわみや定常回転オフセットを除去
3. 変動成分を空間モード `sin(nπi/(N−1))` に射影:

   ```
   Â_n = (2/(N−1)) · √( (Σ u1_i·s_i)² + (Σ u2_i·s_i)² ),   s_i = sin(nπi/(N−1))
   ```

4. **Mode purity** はエネルギー基準: `P_n = Â_n² / Σ_k Â_k²`
5. **節(Node)** は「瞬間的に中央を通過した点」ではなく、
   `E[|u_i|²]` の時間平均が周囲より十分小さい粒子として検出。
   推定ループ数 = 内部節数 + 1 を表示します

## シミュレーションモデル / Simulation model

- **縄**: 粒子 + XPBD 距離制約(非伸縮)。屈曲剛性は第二近接距離制約で近似
- **回し手**: 完全な円運動(腕の軌道・力制限なし)
- **物理ステップ**: 固定 1/240 s + アキュムレータ。描画 FPS と分離
- **空気抵抗**: 線形減衰 + 2次抵抗(線密度あたり)の簡易モデル
- **無視しているもの**: 縄の断面変形・捻れ、人間との衝突、跳び人、
  手の力制限、非完全円軌道

したがって「この結果が実際の大縄で必ず成立する」とは断定しません。
傾向と条件の探索ツールとして使ってください。

## これまでの観察メモ / Preliminary findings

ヘッドレスパラメータ走査(デフォルト縄: 9 m / 1.2 kg / 121 particles)では:

- **位相 0°(同相)**: 常に n=1 が支配的。対称性により偶数モード
  (n=2,4,6)はほぼ励起されない — 物理的に妥当なパリティ選択則
- **位相 180°(逆相)**: n=2 が支配的になり1つの内部節が安定して出現
  (≈0.6–1.5 Hz)。奇数モードは抑制される
- **n=3(トリプル)**: 同相駆動では n=3 成分は励起されるものの
  (振幅 ~0.2–0.3 m)、このモデルでは n=1 を上回る純粋な3ループ定常状態は
  未確認。重い縄(2.0–2.5 kg)・低減衰で最も応答が大きい。
  Frequency Sweep (Triple Search プリセット) で条件探索が可能

これらはあくまでこのシミュレーションモデル内の観察です。

## プロジェクト構成

```
src/
  physics/     Rope(粒子状態), XPBDSolver, Distance/BendingConstraint, EndDriver
  simulation/  LongRopeSimulation(固定 timestep), presets, types
  analysis/    ModeAnalyzer, NodeDetector, FrequencySweep, History(CSV)
  rendering/   Scene(Three.js), RopeRenderer(チューブ), NodeRenderer, TrailRenderer
  ui/          lil-gui controls, HUD, mode spectrum, sweep chart
  utils/       math, config(Export/Import/URL hash)
test/          vitest — 制約・ソルバ・解析・config の数値テスト
```

## License

MIT — see [LICENSE](LICENSE).
