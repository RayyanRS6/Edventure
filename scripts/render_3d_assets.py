import numpy as np
from PIL import Image
import os

os.makedirs('/Users/arhamawan/Documents/Edventure/apps/mobile/assets/3d', exist_ok=True)

def normalize(v):
    norm = np.linalg.norm(v, axis=-1, keepdims=True)
    return np.where(norm == 0, v, v / norm)

def render_3d_character(filename, char_type='boy', res=420):
    # Camera setup
    x = np.linspace(-1.05, 1.05, res)
    y = np.linspace(1.05, -1.05, res)
    xx, yy = np.meshgrid(x, y)
    
    ro = np.array([0.0, 0.0, 2.6])
    rd = normalize(np.stack([xx, yy, -np.ones_like(xx)], axis=-1))
    
    # Palettes
    if char_type == 'boy':
        bubble_glow = np.array([0.40, 0.95, 0.75]) # Mint Green
        skin = np.array([0.96, 0.80, 0.70])
        hair = np.array([0.28, 0.18, 0.14])
        shirt = np.array([0.25, 0.75, 0.68])
        rim = np.array([0.55, 1.0, 0.85])
    elif char_type == 'girl':
        bubble_glow = np.array([0.76, 0.52, 0.98]) # Lavender Purple
        skin = np.array([0.97, 0.82, 0.72])
        hair = np.array([0.45, 0.22, 0.32])
        shirt = np.array([0.65, 0.40, 0.88])
        rim = np.array([0.90, 0.70, 1.0])
    else: # teacher
        bubble_glow = np.array([0.98, 0.74, 0.22]) # Warm Amber
        skin = np.array([0.96, 0.80, 0.70])
        hair = np.array([0.84, 0.50, 0.22])
        shirt = np.array([0.92, 0.65, 0.18])
        rim = np.array([1.0, 0.88, 0.45])

    def sdf_scene(p):
        px, py, pz = p[..., 0], p[..., 1], p[..., 2]
        
        # Large Head (r = 0.56, fills most of the frame)
        d_head = np.sqrt(px**2 + (py - 0.04)**2 + pz**2) - 0.56
        
        # Nose: cute button nose
        d_nose = np.sqrt(px**2 + (py + 0.05)**2 + (pz - 0.54)**2) - 0.08
        
        # Ears: (+-0.54, 0.0, 0.0)
        d_ears = np.sqrt((np.abs(px) - 0.56)**2 + (py - 0.02)**2 + pz**2) - 0.14
        
        # Hair
        if char_type == 'boy':
            # Volumetric hair cap
            d_hair_cap = np.sqrt(px**2 + (py - 0.32)**2 + (pz - 0.04)**2) - 0.52
            # Front swoosh
            d_hair_swoosh = np.sqrt((px - 0.18)**2 + (py - 0.48)**2 + (pz - 0.25)**2) - 0.28
            d_hair = np.minimum(d_hair_cap, d_hair_swoosh)
        elif char_type == 'girl':
            # Hair dome
            d_hair_cap = np.sqrt(px**2 + (py - 0.28)**2 + pz**2) - 0.58
            # Side locks
            d_locks = np.sqrt((np.abs(px) - 0.48)**2 + (py + 0.08)**2 + (pz + 0.05)**2) - 0.26
            # Top bun
            d_bun = np.sqrt(px**2 + (py - 0.70)**2 + (pz + 0.05)**2) - 0.22
            d_hair = np.minimum(np.minimum(d_hair_cap, d_locks), d_bun)
        else: # teacher
            # Styled hair parted
            d_hair_cap = np.sqrt(px**2 + (py - 0.26)**2 + pz**2) - 0.57
            d_side = np.sqrt((np.abs(px) - 0.50)**2 + (py - 0.02)**2 + (pz + 0.02)**2) - 0.26
            d_hair = np.minimum(d_hair_cap, d_side)

        # Body/Shoulders
        d_body = np.sqrt(px**2 / 1.5 + (py + 0.92)**2 / 0.7 + pz**2) - 0.62
        
        # Eyes: glossy black sphere pupils (+-0.20, 0.10, 0.50)
        d_eyes = np.sqrt((np.abs(px) - 0.20)**2 + (py - 0.10)**2 + (pz - 0.50)**2) - 0.075
        
        # Cheeks blush
        d_cheeks = np.sqrt((np.abs(px) - 0.32)**2 + (py + 0.06)**2 + (pz - 0.45)**2) - 0.10
        
        # Glasses for teacher
        if char_type == 'teacher':
            d_lens = np.sqrt((np.abs(px) - 0.21)**2 + (py - 0.10)**2 + (pz - 0.57)**2) - 0.16
            d_frame = np.abs(d_lens) - 0.022
            # Bridge
            d_bridge = np.sqrt(px**2 + (py - 0.10)**2 + (pz - 0.57)**2) - 0.02
            d_glasses = np.minimum(d_frame, d_bridge)
        else:
            d_glasses = 999.0
            
        d_character = np.minimum(np.minimum(np.minimum(d_head, d_nose), d_ears), d_hair)
        d_character = np.minimum(np.minimum(d_character, d_body), d_eyes)
        if char_type == 'teacher':
            d_character = np.minimum(d_character, d_glasses)
            
        return d_character, d_head, d_hair, d_body, d_eyes, d_cheeks, d_glasses

    # Raymarch character
    t = np.full(xx.shape, 1.3)
    hit = np.zeros(xx.shape, dtype=bool)
    
    for step in range(32):
        pos = ro + rd * t[..., None]
        d, _, _, _, _, _, _ = sdf_scene(pos)
        t += d
        hit = hit | (d < 0.005)
        t = np.where(hit, t, t)

    pos = ro + rd * t[..., None]
    eps = 0.006
    dx = sdf_scene(pos + np.array([eps, 0, 0]))[0] - sdf_scene(pos - np.array([eps, 0, 0]))[0]
    dy = sdf_scene(pos + np.array([0, eps, 0]))[0] - sdf_scene(pos - np.array([0, eps, 0]))[0]
    dz = sdf_scene(pos + np.array([0, 0, eps]))[0] - sdf_scene(pos - np.array([0, 0, eps]))[0]
    normal = normalize(np.stack([dx, dy, dz], axis=-1))
    
    _, d_head, d_hair, d_body, d_eyes, d_cheeks, d_glasses = sdf_scene(pos)
    
    # Lighting
    key_light = normalize(np.array([0.5, 0.8, 1.0]))
    fill_light = normalize(np.array([-0.6, -0.3, 0.6]))
    rim_light = normalize(np.array([-0.8, 0.9, -0.5]))
    view = -rd
    
    diff_key = np.maximum(0.0, np.sum(normal * key_light, axis=-1))
    diff_fill = np.maximum(0.0, np.sum(normal * fill_light, axis=-1)) * 0.35
    fresnel = np.maximum(0.0, 1.0 - np.sum(normal * view, axis=-1)) ** 2.2
    
    h_key = normalize(key_light + view)
    spec_key = np.maximum(0.0, np.sum(normal * h_key, axis=-1)) ** 28
    
    # Material colors
    color = np.zeros(xx.shape + (3,))
    color[d_head <= 0.02] = skin
    color[d_hair <= 0.02] = hair
    color[d_body <= 0.02] = shirt
    
    # Cheeks
    blush = (d_cheeks < 0.025) & (d_head < 0.02)
    color[blush] = skin * 0.70 + np.array([1.0, 0.40, 0.42]) * 0.30
    
    # Glasses
    if char_type == 'teacher':
        color[d_glasses < 0.015] = np.array([0.14, 0.12, 0.16])
        
    # Eyes
    eye_hit = d_eyes < 0.015
    color[eye_hit] = np.array([0.05, 0.05, 0.07])
    
    # Shading computation
    ambient = 0.38
    rgb = color * (ambient + diff_key * 0.72 + diff_fill * 0.3)[..., None]
    rgb += spec_key[..., None] * 0.32
    rgb += fresnel[..., None] * rim * 0.50
    
    # Pupil catchlight
    pupil_spec = eye_hit & (spec_key > 0.35)
    rgb[pupil_spec] = np.array([1.0, 1.0, 1.0])
    
    # Outer Glass Bubble
    dist_r = np.sqrt(xx**2 + yy**2)
    R_BUBBLE = 0.96
    bubble_active = dist_r <= R_BUBBLE
    
    z_b = np.sqrt(np.maximum(0.0, R_BUBBLE**2 - xx**2 - yy**2))
    n_b = normalize(np.stack([xx, yy, z_b], axis=-1))
    
    bubble_fresnel = np.maximum(0.0, 1.0 - n_b[..., 2]) ** 1.8
    h_b = normalize(key_light + np.array([0.0, 0.0, 1.0]))
    bubble_spec = np.maximum(0.0, np.sum(n_b * h_b, axis=-1)) ** 36
    
    # Composite
    out_rgb = np.zeros(xx.shape + (3,))
    out_alpha = np.zeros(xx.shape)
    
    # Inside character
    inside_char = hit & bubble_active
    out_rgb[inside_char] = rgb[inside_char]
    out_alpha[inside_char] = 1.0
    
    # Glass area surrounding character
    surround = bubble_active & (~inside_char)
    surround_color = bubble_glow * 0.8 + rim * 0.2 + bubble_spec[..., None] * 0.6
    surround_alpha = bubble_fresnel * 0.88 + bubble_spec * 0.95 + 0.16
    out_rgb[surround] = surround_color[surround]
    out_alpha[surround] = surround_alpha[surround]
    
    # Specular sheen on top of character
    out_rgb[inside_char] += bubble_spec[inside_char, None] * 0.45
    out_rgb[inside_char] += bubble_fresnel[inside_char, None] * rim * 0.30
    
    # Feather boundary
    feather = np.clip((R_BUBBLE - dist_r) / 0.03, 0.0, 1.0)
    out_alpha = out_alpha * feather
    
    # Output
    final_rgb = np.clip(out_rgb * 255.0, 0, 255).astype(np.uint8)
    final_a = np.clip(out_alpha * 255.0, 0, 255).astype(np.uint8)
    rgba = np.dstack([final_rgb, final_a])
    
    Image.fromarray(rgba).save(filename)
    print(f'Rendered {char_type} -> {filename}')

def render_3d_torus(filename, res=400):
    # 3D Glossy Clay Torus (as in mood board Plate 01 & 02)
    x = np.linspace(-1.1, 1.1, res)
    y = np.linspace(1.1, -1.1, res)
    xx, yy = np.meshgrid(x, y)
    
    ro = np.array([0.0, 0.0, 2.5])
    rd = normalize(np.stack([xx, yy, -np.ones_like(xx)], axis=-1))
    
    # Tilted torus SDF
    # Rotate around X by 35 deg, Y by -20 deg
    rot_x = np.radians(35)
    rot_y = np.radians(-25)
    
    cx_cos, cx_sin = np.cos(rot_x), np.sin(rot_x)
    cy_cos, cy_sin = np.cos(rot_y), np.sin(rot_y)
    
    def rotate(p):
        px, py, pz = p[..., 0], p[..., 1], p[..., 2]
        # Y rot
        rx = cy_cos * px + cy_sin * pz
        ry = py
        rz = -cy_sin * px + cy_cos * pz
        # X rot
        fx = rx
        fy = cx_cos * ry - cx_sin * rz
        fz = cx_sin * ry + cx_cos * rz
        return fx, fy, fz

    def sdf_torus(p):
        fx, fy, fz = rotate(p)
        # Torus: major radius R=0.62, minor radius r=0.22
        q = np.sqrt(fx**2 + fz**2) - 0.62
        return np.sqrt(q**2 + fy**2) - 0.22

    t = np.full(xx.shape, 1.4)
    hit = np.zeros(xx.shape, dtype=bool)
    for _ in range(32):
        pos = ro + rd * t[..., None]
        d = sdf_torus(pos)
        t += d
        hit = hit | (d < 0.005)
        t = np.where(hit, t, t)
        
    pos = ro + rd * t[..., None]
    eps = 0.006
    dx = sdf_torus(pos + np.array([eps, 0, 0])) - sdf_torus(pos - np.array([eps, 0, 0]))
    dy = sdf_torus(pos + np.array([0, eps, 0])) - sdf_torus(pos - np.array([0, eps, 0]))
    dz = sdf_torus(pos + np.array([0, 0, eps])) - sdf_torus(pos - np.array([0, 0, eps]))
    normal = normalize(np.stack([dx, dy, dz], axis=-1))
    
    key_light = normalize(np.array([0.6, 0.8, 0.9]))
    fill_light = normalize(np.array([-0.7, -0.4, 0.4]))
    view = -rd
    
    diff = np.maximum(0.0, np.sum(normal * key_light, axis=-1))
    fill = np.maximum(0.0, np.sum(normal * fill_light, axis=-1))
    fresnel = np.maximum(0.0, 1.0 - np.sum(normal * view, axis=-1)) ** 2.4
    
    h = normalize(key_light + view)
    spec = np.maximum(0.0, np.sum(normal * h, axis=-1)) ** 30
    
    # Dual-tone clay gradient (Lilac #BCA8F4 into Lime #D4FF32 rim)
    base_color = np.array([0.74, 0.66, 0.96]) # Soft Lilac
    lime_color = np.array([0.83, 1.0, 0.20]) # Electric Lime
    
    shaded = base_color * (0.35 + diff * 0.75 + fill * 0.3)[..., None]
    shaded += spec[..., None] * 0.45
    shaded += fresnel[..., None] * lime_color * 0.70
    
    out_rgb = np.zeros(xx.shape + (3,))
    out_alpha = np.zeros(xx.shape)
    
    out_rgb[hit] = shaded[hit]
    out_alpha[hit] = 1.0
    
    rgba = np.dstack([np.clip(out_rgb * 255.0, 0, 255).astype(np.uint8), np.clip(out_alpha * 255.0, 0, 255).astype(np.uint8)])
    Image.fromarray(rgba).save(filename)
    print(f'Rendered Torus -> {filename}')

def render_3d_trophy(filename, res=400):
    # 3D Golden Trophy Cup
    x = np.linspace(-1.1, 1.1, res)
    y = np.linspace(1.1, -1.1, res)
    xx, yy = np.meshgrid(x, y)
    
    ro = np.array([0.0, 0.0, 2.5])
    rd = normalize(np.stack([xx, yy, -np.ones_like(xx)], axis=-1))
    
    def sdf_trophy(p):
        px, py, pz = p[..., 0], p[..., 1], p[..., 2]
        
        # Cup body: bowl
        d_cup = np.sqrt(px**2 / 1.1 + (py - 0.22)**2 / 1.4 + pz**2) - 0.42
        d_hollow = np.sqrt(px**2 / 0.9 + (py - 0.28)**2 / 1.4 + pz**2) - 0.38
        d_bowl = np.maximum(d_cup, -d_hollow)
        # cut flat top
        d_bowl = np.maximum(d_bowl, py - 0.50)
        
        # Stem
        d_stem = np.sqrt(px**2 / 0.15 + (py + 0.35)**2 / 0.6 + pz**2 / 0.15) - 0.18
        
        # Base: two stepped cylinders
        d_base1 = np.maximum(np.sqrt(px**2 + pz**2) - 0.38, np.abs(py + 0.55) - 0.07)
        d_base2 = np.maximum(np.sqrt(px**2 + pz**2) - 0.48, np.abs(py + 0.66) - 0.07)
        
        # Handles (tori on sides)
        hx = np.abs(px) - 0.44
        hy = py - 0.22
        d_handle = np.sqrt((np.sqrt(hx**2 + pz**2) - 0.18)**2 + hy**2) - 0.045
        
        return np.minimum(np.minimum(np.minimum(d_bowl, d_stem), np.minimum(d_base1, d_base2)), d_handle)

    t = np.full(xx.shape, 1.4)
    hit = np.zeros(xx.shape, dtype=bool)
    for _ in range(32):
        pos = ro + rd * t[..., None]
        d = sdf_trophy(pos)
        t += d
        hit = hit | (d < 0.005)
        t = np.where(hit, t, t)
        
    pos = ro + rd * t[..., None]
    eps = 0.006
    dx = sdf_trophy(pos + np.array([eps, 0, 0])) - sdf_trophy(pos - np.array([eps, 0, 0]))
    dy = sdf_trophy(pos + np.array([0, eps, 0])) - sdf_trophy(pos - np.array([0, eps, 0]))
    dz = sdf_trophy(pos + np.array([0, 0, eps])) - sdf_trophy(pos - np.array([0, 0, eps]))
    normal = normalize(np.stack([dx, dy, dz], axis=-1))
    
    key_light = normalize(np.array([0.5, 0.8, 1.0]))
    fill_light = normalize(np.array([-0.6, -0.3, 0.5]))
    view = -rd
    
    diff = np.maximum(0.0, np.sum(normal * key_light, axis=-1))
    fill = np.maximum(0.0, np.sum(normal * fill_light, axis=-1))
    fresnel = np.maximum(0.0, 1.0 - np.sum(normal * view, axis=-1)) ** 2.2
    
    h = normalize(key_light + view)
    spec = np.maximum(0.0, np.sum(normal * h, axis=-1)) ** 36
    
    # 24k Gold color
    gold = np.array([1.0, 0.78, 0.18])
    gold_highlight = np.array([1.0, 0.94, 0.65])
    
    shaded = gold * (0.35 + diff * 0.75 + fill * 0.3)[..., None]
    shaded += spec[..., None] * gold_highlight * 0.65
    shaded += fresnel[..., None] * gold_highlight * 0.50
    
    out_rgb = np.zeros(xx.shape + (3,))
    out_alpha = np.zeros(xx.shape)
    
    out_rgb[hit] = shaded[hit]
    out_alpha[hit] = 1.0
    
    rgba = np.dstack([np.clip(out_rgb * 255.0, 0, 255).astype(np.uint8), np.clip(out_alpha * 255.0, 0, 255).astype(np.uint8)])
    Image.fromarray(rgba).save(filename)
    print(f'Rendered Trophy -> {filename}')

render_3d_character('/Users/arhamawan/Documents/Edventure/apps/mobile/assets/3d/clay_boy.png', 'boy')
render_3d_character('/Users/arhamawan/Documents/Edventure/apps/mobile/assets/3d/clay_girl.png', 'girl')
render_3d_character('/Users/arhamawan/Documents/Edventure/apps/mobile/assets/3d/clay_teacher.png', 'teacher')
render_3d_torus('/Users/arhamawan/Documents/Edventure/apps/mobile/assets/3d/clay_torus.png')
render_3d_trophy('/Users/arhamawan/Documents/Edventure/apps/mobile/assets/3d/gold_trophy.png')
print('ALL 3D OBJECTS GENERATED SUCCESSFULLY!')
