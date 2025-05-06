import pygame
import sys

# Constants
BOARD_SIZE = 9           # Komi board size
CELL_SIZE = 80           # Size of each square cell
MARGIN = 20              # Margin around the board
WINDOW_SIZE = BOARD_SIZE * CELL_SIZE + MARGIN * 2
CAPTURE_LIMIT = 10       # Stones needed to win
FPS = 60                 # Frames per second

# Colors (harmonious palette)
WHITE = (236, 240, 241)      # Light stone color
BLACK = (44, 62, 80)         # Dark stone color
BOARD_BG = (34, 49, 63)      # Deep blue-gray board background
GRID_COLOR = (178, 190, 195) # Soft silver grid lines
HIGHLIGHT = (46, 204, 113)   # Vibrant green hover highlight
OVERLAY = (0, 0, 0, 200)     # Semi-transparent dark overlay

pygame.init()
screen = pygame.display.set_mode((WINDOW_SIZE, WINDOW_SIZE))
pygame.display.set_caption("Komi - Warframe Mini-game")
clock = pygame.time.Clock()
font = pygame.font.SysFont("arial", 32, bold=True)
small_font = pygame.font.SysFont("arial", 24)

# Game state
board = [[0] * BOARD_SIZE for _ in range(BOARD_SIZE)]
current_player = 1
captured_counts = {1: 0, 2: 0}
banned_moves = set()
animating = []  # list of [x, y, progress, color]
winner = None

def draw_board():
    screen.fill(BOARD_BG)
    # Draw grid lines
    for i in range(BOARD_SIZE + 1):
        start_h = (MARGIN, MARGIN + i * CELL_SIZE)
        end_h = (MARGIN + BOARD_SIZE * CELL_SIZE, MARGIN + i * CELL_SIZE)
        pygame.draw.line(screen, GRID_COLOR, start_h, end_h, 3)
        start_v = (MARGIN + i * CELL_SIZE, MARGIN)
        end_v = (MARGIN + i * CELL_SIZE, MARGIN + BOARD_SIZE * CELL_SIZE)
        pygame.draw.line(screen, GRID_COLOR, start_v, end_v, 3)

    # Highlight hover cell
    if not winner:
        mx, my = pygame.mouse.get_pos()
        cell = get_cell((mx, my))
        if cell and board[cell[1]][cell[0]] == 0 and cell not in banned_moves:
            x, y = cell
            rect = pygame.Rect(
                MARGIN + x * CELL_SIZE + 3,
                MARGIN + y * CELL_SIZE + 3,
                CELL_SIZE - 6,
                CELL_SIZE - 6
            )
            pygame.draw.rect(screen, HIGHLIGHT, rect, 3)

    # Draw stones
    for y in range(BOARD_SIZE):
        for x in range(BOARD_SIZE):
            val = board[y][x]
            if val:
                draw_stone(x, y, val, 1)

    # Handle drop animations
    for anim in animating[:]:
        ax, ay, prog, color = anim
        draw_stone(ax, ay, color, prog)
        anim[2] += 0.1
        if anim[2] >= 1.0:
            animating.remove(anim)

    # Draw score and turn
    score_surf = small_font.render(
        f"Captures: {captured_counts[1]} - {captured_counts[2]}", True, WHITE
    )
    screen.blit(
        score_surf,
        (MARGIN, WINDOW_SIZE - MARGIN - score_surf.get_height())
    )

    if not winner:
        turn_color = BLACK if current_player == 1 else WHITE
        turn_text = "Black's Turn" if current_player == 1 else "White's Turn"
        turn_surf = small_font.render(turn_text, True, turn_color)
        screen.blit(
            turn_surf,
            ((WINDOW_SIZE - turn_surf.get_width()) // 2, MARGIN // 2)
        )

    # Draw winner overlay
    if winner:
        overlay = pygame.Surface((WINDOW_SIZE, WINDOW_SIZE), pygame.SRCALPHA)
        overlay.fill(OVERLAY)
        screen.blit(overlay, (0, 0))
        text = f"Player {winner} Wins!"
        win_surf = font.render(text, True, WHITE if winner == 2 else BLACK)
        screen.blit(
            win_surf,
            (
                (WINDOW_SIZE - win_surf.get_width()) // 2,
                (WINDOW_SIZE - win_surf.get_height()) // 2
            )
        )
        retry = small_font.render("Click to Restart", True, WHITE)
        screen.blit(
            retry,
            (
                (WINDOW_SIZE - retry.get_width()) // 2,
                (WINDOW_SIZE - retry.get_height()) // 2 + 50
            )
        )

    pygame.display.flip()


def draw_stone(x, y, color, scale):
    center = (
        MARGIN + x * CELL_SIZE + CELL_SIZE // 2,
        MARGIN + y * CELL_SIZE + CELL_SIZE // 2
    )
    radius = int((CELL_SIZE // 2 - 8) * scale)
    col = BLACK if color == 1 else WHITE
    pygame.draw.circle(screen, col, center, radius)
    pygame.draw.circle(screen, GRID_COLOR, center, radius, 2)


def get_cell(pos):
    x, y = pos
    if MARGIN <= x <= WINDOW_SIZE - MARGIN and MARGIN <= y <= WINDOW_SIZE - MARGIN:
        return ((x - MARGIN) // CELL_SIZE, (y - MARGIN) // CELL_SIZE)
    return None


def neighbors(x, y):
    for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE:
            yield nx, ny


def flood_fill(x, y, color, visited):
    stack = [(x, y)]
    group = []
    libs = set()
    while stack:
        cx, cy = stack.pop()
        if (cx, cy) in visited:
            continue
        visited.add((cx, cy))
        group.append((cx, cy))
        for nx, ny in neighbors(cx, cy):
            if board[ny][nx] == color and (nx, ny) not in visited:
                stack.append((nx, ny))
            elif board[ny][nx] == 0:
                libs.add((nx, ny))
    return group, libs


def remove_captured(x, y):
    enemy = 2 if current_player == 1 else 1
    visited = set()
    removed = []
    for nx, ny in neighbors(x, y):
        if board[ny][nx] == enemy and (nx, ny) not in visited:
            group, libs = flood_fill(nx, ny, enemy, visited)
            if not libs:
                removed.extend(group)
    for rx, ry in removed:
        board[ry][rx] = 0
    return removed


def reset():
    global board, current_player, captured_counts, banned_moves, winner, animating
    board = [[0] * BOARD_SIZE for _ in range(BOARD_SIZE)]
    current_player = 1
    captured_counts = {1: 0, 2: 0}
    banned_moves = set()
    animating = []
    winner = None


def main():
    global current_player, banned_moves, winner
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                if winner:
                    reset()
                    break
                cell = get_cell(event.pos)
                if cell and board[cell[1]][cell[0]] == 0 and cell not in banned_moves:
                    x, y = cell
                    board[y][x] = current_player
                    animating.append([x, y, 0.0, current_player])
                    removed = remove_captured(x, y)
                    captured_counts[current_player] += len(removed)
                    banned_moves = set(removed) if removed else set()
                    if captured_counts[current_player] >= CAPTURE_LIMIT:
                        winner = current_player
                    current_player = 2 if current_player == 1 else 1

        draw_board()
        # Tick the clock to regulate FPS
        clock.tick(FPS)


if __name__ == "__main__":
    main()
