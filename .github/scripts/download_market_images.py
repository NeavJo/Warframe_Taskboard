"""
download_market_images.py

从 warframe-items CDN 下载市场查价页所需的物品缩略图到 data/img/。
只下载没有本地 SVG 占位符的物品图片（排除部件/mod/遗物）。
并行下载 + 增量更新（已存在的文件跳过）。
"""

import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

IMG_DIR = 'data/img'
ITEMS_JSON = 'data/wf_market_items.json'
CDN_BASE = 'https://cdn.jsdelivr.net/gh/WFCD/warframe-items@master/data/img'
CONCURRENCY = 10  # 并行下载数


def slug_to_image_filename(slug):
    """匹配前端 wmSlugToImageFilename 逻辑"""
    s = slug.lower()
    if s.endswith('_set'):
        s = s[:-4]
    return ''.join(w.capitalize() for w in s.split('_')) + '.png'


def needs_image(item):
    """
    判断物品是否需要下载图片。
    返回 False = 有本地 SVG 占位符，不需要下载。
    匹配前端 _renderAutocomplete 判断逻辑。
    """
    slug = (item.get('slug') or '').lower()
    tags = item.get('tags') or []

    # relic → 篮球图标占位符
    if 'relic' in tags:
        return False

    # mod → 中空卡片占位符
    if 'mod' in tags:
        return False

    # 部件/蓝图 → SVG 占位符（匹配 wmGetComponentType 逻辑）
    component_keywords = [
        '_neuroptics_blueprint', '_chassis_blueprint', '_systems_blueprint',
        '_blueprint',
        '_barrel', '_receiver', '_stock', '_blade',
        '_handle', '_grip', '_limb',
        '_link', '_connector', '_string',
    ]
    for kw in component_keywords:
        if kw in slug:
            return False

    return True


def download_image(filename):
    """下载单张图片，返回 (filename, success, reason)"""
    filepath = os.path.join(IMG_DIR, filename)

    if os.path.exists(filepath):
        return (filename, True, 'skipped')

    url = f'{CDN_BASE}/{filename}'
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (WF Taskboard Image Downloader)',
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            if len(data) < 50:
                return (filename, False, f'too small ({len(data)} bytes)')
            os.makedirs(IMG_DIR, exist_ok=True)
            with open(filepath, 'wb') as f:
                f.write(data)
            return (filename, True, f'downloaded ({len(data)} bytes)')
    except Exception as e:
        return (filename, False, str(e))


def main():
    # 读取物品列表
    if not os.path.exists(ITEMS_JSON):
        print(f'ERROR: {ITEMS_JSON} not found. Run sync-market-items first.')
        sys.exit(1)

    with open(ITEMS_JSON, 'rb') as f:
        data = json.load(f)

    items = data.get('data', [])
    if not items:
        print('ERROR: Empty items data.')
        sys.exit(1)

    print(f'Loaded {len(items)} items from {ITEMS_JSON}')

    # 筛选需要图片的物品
    need_images = [item for item in items if needs_image(item)]
    print(f'Need images: {len(need_images)} (skipped {len(items) - len(need_images)} with placeholders)')

    # 计算文件名
    filenames = []
    for item in need_images:
        slug = item.get('slug', '')
        if slug:
            filenames.append(slug_to_image_filename(slug))

    # 去重（多个 slug 可能映射到同一文件名，如 xxx_set 和 xxx）
    unique_filenames = list(set(filenames))
    print(f'Unique image files: {len(unique_filenames)}')

    # 检查已存在的
    existing = 0
    for fn in unique_filenames:
        if os.path.exists(os.path.join(IMG_DIR, fn)):
            existing += 1
    print(f'Already existing: {existing}')
    print(f'Need to download: {len(unique_filenames) - existing}')

    if existing == len(unique_filenames):
        print('All images already downloaded. Nothing to do.')
        return

    # 并行下载
    downloaded = 0
    failed = 0
    skipped = 0

    print(f'Downloading with {CONCURRENCY} parallel workers...')
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        future_map = {executor.submit(download_image, fn): fn for fn in unique_filenames}
        for future in as_completed(future_map):
            fn, success, reason = future.result()
            if success:
                if reason == 'skipped':
                    skipped += 1
                else:
                    downloaded += 1
                    print(f'  + {fn} ({reason})')
            else:
                failed += 1
                print(f'  ! {fn} failed: {reason}')

    print(f'\nDone: {downloaded} downloaded, {skipped} skipped, {failed} failed')


if __name__ == '__main__':
    main()
