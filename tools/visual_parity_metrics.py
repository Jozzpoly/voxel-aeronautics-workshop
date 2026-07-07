#!/usr/bin/env python3
"""Rendered visual parity metrics for Studio-vs-game PNG pairs (m4l-104 prep scaffold)."""

from __future__ import annotations

import argparse
import json
import warnings
from pathlib import Path

from PIL import Image, UnidentifiedImageError

DEFAULT_THRESHOLDS = {
    'ssimMin': 0.92,
    'luminanceDeltaMax': 0.08,
}


def image_luminance_stats(image: Image.Image) -> dict:
    rgba = image.convert('RGBA')
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', DeprecationWarning)
        pixels = list(rgba.getdata())
    visible = [pixel for pixel in pixels if pixel[3] > 0]
    if not visible:
        return {
            'visiblePixels': 0,
            'average': None,
            'min': None,
            'max': None,
        }
    lumas = [(0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 for r, g, b, _ in visible]
    return {
        'visiblePixels': len(visible),
        'average': round(sum(lumas) / len(lumas), 4),
        'min': round(min(lumas), 4),
        'max': round(max(lumas), 4),
    }


def load_grayscale_matrix(path: Path) -> list[list[float]]:
    try:
        with Image.open(path) as image:
            gray = image.convert('L')
            width, height = gray.size
            data = list(gray.getdata())
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise ValueError(f'Unable to read image {path}: {error}') from error
    return [data[row * width:(row + 1) * width] for row in range(height)]


def structural_similarity(left: Path, right: Path) -> float:
    """Lightweight SSIM approximation using 8x8 mean windows (prep scaffold)."""
    left_matrix = load_grayscale_matrix(left)
    right_matrix = load_grayscale_matrix(right)
    if len(left_matrix) != len(right_matrix) or len(left_matrix[0]) != len(right_matrix[0]):
        raise ValueError('Image dimensions must match for SSIM comparison.')

    height = len(left_matrix)
    width = len(left_matrix[0])
    window = 8
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    scores: list[float] = []

    for y in range(0, height - window + 1, window):
        for x in range(0, width - window + 1, window):
            patch_left = [
                left_matrix[row][x:x + window]
                for row in range(y, y + window)
            ]
            patch_right = [
                right_matrix[row][x:x + window]
                for row in range(y, y + window)
            ]
            flat_left = [value for row in patch_left for value in row]
            flat_right = [value for row in patch_right for value in row]
            mean_left = sum(flat_left) / len(flat_left)
            mean_right = sum(flat_right) / len(flat_right)
            var_left = sum((value - mean_left) ** 2 for value in flat_left) / len(flat_left)
            var_right = sum((value - mean_right) ** 2 for value in flat_right) / len(flat_right)
            cov = sum(
                (left_value - mean_left) * (right_value - mean_right)
                for left_value, right_value in zip(flat_left, flat_right)
            ) / len(flat_left)
            numerator = (2 * mean_left * mean_right + c1) * (2 * cov + c2)
            denominator = (mean_left ** 2 + mean_right ** 2 + c1) * (var_left + var_right + c2)
            if denominator:
                scores.append(max(0.0, min(1.0, numerator / denominator)))

    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 4)


def compare_pair(
    studio_png: Path,
    game_png: Path,
    thresholds: dict | None = None,
) -> dict:
    thresholds = thresholds or DEFAULT_THRESHOLDS
    with Image.open(studio_png) as studio_image, Image.open(game_png) as game_image:
        studio_luma = image_luminance_stats(studio_image)
        game_luma = image_luminance_stats(game_image)
    ssim = structural_similarity(studio_png, game_png)
    studio_avg = studio_luma.get('average')
    game_avg = game_luma.get('average')
    delta = None
    if studio_avg is not None and game_avg is not None:
        delta = round(game_avg - studio_avg, 4)
    within = (
        ssim >= thresholds['ssimMin']
        and delta is not None
        and abs(delta) <= thresholds['luminanceDeltaMax']
    )
    return {
        'ssim': ssim,
        'averageLuminance': {
            'studio': studio_avg,
            'game': game_avg,
            'delta': delta,
        },
        'withinThresholds': within,
        'thresholds': thresholds,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description='Compare Studio vs game rendered PNG parity metrics.')
    parser.add_argument('--studio', type=Path, required=True, help='Studio capture PNG path.')
    parser.add_argument('--game', type=Path, required=True, help='Game capture PNG path.')
    parser.add_argument('--json-out', type=Path, default=None, help='Optional JSON output path.')
    parser.add_argument('--ssim-min', type=float, default=DEFAULT_THRESHOLDS['ssimMin'])
    parser.add_argument('--luminance-delta-max', type=float, default=DEFAULT_THRESHOLDS['luminanceDeltaMax'])
    args = parser.parse_args()

    thresholds = {
        'ssimMin': args.ssim_min,
        'luminanceDeltaMax': args.luminance_delta_max,
    }
    report = {
        'visualParityMetrics': 'M4L',
        'studioPng': str(args.studio.resolve()),
        'gamePng': str(args.game.resolve()),
        'metrics': compare_pair(args.studio.resolve(), args.game.resolve(), thresholds),
    }
    payload = json.dumps(report, indent=2)
    print(payload)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(payload + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()