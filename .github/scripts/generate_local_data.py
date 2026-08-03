#!/usr/bin/env python3
"""
generate_local_data.py — 将 data/ 目录下的 JSON 文件转为 JS wrapper，
使其能通过 <script> 标签在 file:// 协议下直接加载。

用法：python .github/scripts/generate_local_data.py
"""
import json
import os

DATA_DIR = 'data'

# JSON 文件 → JS 全局变量名 映射
MAPPINGS = [
    ('wf_market_items.json',   '__WM_ITEMS_DATA'),
    ('arbys.schedule.v2.json', '__ARBI_SCHEDULE'),
    ('arbys.nodes.zh.json',    '__ARBI_NODES'),
    ('tierlist.default.json',  '__ARBI_TIERLIST'),
]

def generate(js_name, var_name):
    json_path = os.path.join(DATA_DIR, js_name)
    if not os.path.exists(json_path):
        print(f'  跳过 {js_name}（文件不存在）')
        return False

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    js_path = os.path.join(DATA_DIR, js_name.replace('.json', '.js'))
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(f'window.{var_name} = ')
        json.dump(data, f, ensure_ascii=False)
        f.write(';')

    size_kb = os.path.getsize(js_path) / 1024
    print(f'  ✓ {js_name} → {os.path.basename(js_path)} ({size_kb:.0f} KB)')
    return True

def main():
    print('Generating local data JS wrappers...')
    count = 0
    for json_name, var_name in MAPPINGS:
        if generate(json_name, var_name):
            count += 1
    print(f'Done: {count} files generated.')

if __name__ == '__main__':
    main()
