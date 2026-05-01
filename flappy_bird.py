import random
import sys

import pygame

SCREEN_WIDTH = 400
SCREEN_HEIGHT = 600
FPS = 60

GRAVITY = 0.5
FLAP_STRENGTH = -9
PIPE_SPEED = 3
PIPE_GAP = 150
PIPE_SPAWN_INTERVAL = 1500
GROUND_HEIGHT = 80

SKY_BLUE = (113, 197, 207)
GROUND_BROWN = (222, 184, 135)
GROUND_DARK = (160, 120, 80)
PIPE_GREEN = (115, 191, 44)
PIPE_DARK = (87, 145, 33)
BIRD_YELLOW = (255, 213, 0)
BIRD_ORANGE = (252, 134, 30)
BIRD_RED = (220, 60, 60)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
CLOUD = (240, 240, 240)


class Bird:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = 16
        self.velocity = 0
        self.rotation = 0

    def flap(self):
        self.velocity = FLAP_STRENGTH

    def update(self):
        self.velocity += GRAVITY
        self.y += self.velocity
        self.rotation = max(-25, min(self.velocity * 4, 80))

    def draw(self, surface):
        body = pygame.Surface((self.radius * 2 + 6, self.radius * 2), pygame.SRCALPHA)
        pygame.draw.circle(body, BIRD_YELLOW, (self.radius, self.radius), self.radius)
        pygame.draw.circle(body, BLACK, (self.radius, self.radius), self.radius, 2)
        pygame.draw.ellipse(body, BIRD_ORANGE, (4, self.radius - 4, 16, 8))
        pygame.draw.circle(body, WHITE, (self.radius + 6, self.radius - 4), 5)
        pygame.draw.circle(body, BLACK, (self.radius + 7, self.radius - 4), 2)
        beak = [
            (self.radius * 2, self.radius - 3),
            (self.radius * 2 + 6, self.radius),
            (self.radius * 2, self.radius + 3),
        ]
        pygame.draw.polygon(body, BIRD_RED, beak)
        pygame.draw.polygon(body, BLACK, beak, 1)
        rotated = pygame.transform.rotate(body, -self.rotation)
        rect = rotated.get_rect(center=(int(self.x), int(self.y)))
        surface.blit(rotated, rect.topleft)

    def get_rect(self):
        return pygame.Rect(
            self.x - self.radius + 2,
            self.y - self.radius + 2,
            self.radius * 2 - 4,
            self.radius * 2 - 4,
        )


class Pipe:
    WIDTH = 60

    def __init__(self, x):
        self.x = x
        self.gap_y = random.randint(100, SCREEN_HEIGHT - GROUND_HEIGHT - 100 - PIPE_GAP)
        self.passed = False

    def update(self):
        self.x -= PIPE_SPEED

    def offscreen(self):
        return self.x + self.WIDTH < 0

    def draw(self, surface):
        top_rect = pygame.Rect(self.x, 0, self.WIDTH, self.gap_y)
        bottom_rect = pygame.Rect(
            self.x,
            self.gap_y + PIPE_GAP,
            self.WIDTH,
            SCREEN_HEIGHT - GROUND_HEIGHT - (self.gap_y + PIPE_GAP),
        )
        for rect in (top_rect, bottom_rect):
            pygame.draw.rect(surface, PIPE_GREEN, rect)
            pygame.draw.rect(surface, PIPE_DARK, rect, 3)

        cap_w = self.WIDTH + 8
        top_cap = pygame.Rect(self.x - 4, self.gap_y - 24, cap_w, 24)
        bottom_cap = pygame.Rect(self.x - 4, self.gap_y + PIPE_GAP, cap_w, 24)
        for rect in (top_cap, bottom_cap):
            pygame.draw.rect(surface, PIPE_GREEN, rect)
            pygame.draw.rect(surface, PIPE_DARK, rect, 3)

    def collides_with(self, bird_rect):
        top_rect = pygame.Rect(self.x, 0, self.WIDTH, self.gap_y)
        bottom_rect = pygame.Rect(
            self.x,
            self.gap_y + PIPE_GAP,
            self.WIDTH,
            SCREEN_HEIGHT - GROUND_HEIGHT - (self.gap_y + PIPE_GAP),
        )
        return bird_rect.colliderect(top_rect) or bird_rect.colliderect(bottom_rect)


class Cloud:
    def __init__(self, x, y, scale):
        self.x = x
        self.y = y
        self.scale = scale

    def update(self):
        self.x -= 0.4
        if self.x < -80:
            self.x = SCREEN_WIDTH + 40
            self.y = random.randint(40, 200)

    def draw(self, surface):
        s = self.scale
        pygame.draw.circle(surface, CLOUD, (int(self.x), int(self.y)), int(18 * s))
        pygame.draw.circle(surface, CLOUD, (int(self.x + 18 * s), int(self.y - 6 * s)), int(22 * s))
        pygame.draw.circle(surface, CLOUD, (int(self.x + 38 * s), int(self.y)), int(18 * s))


def draw_ground(surface, offset):
    ground_y = SCREEN_HEIGHT - GROUND_HEIGHT
    pygame.draw.rect(surface, GROUND_BROWN, (0, ground_y, SCREEN_WIDTH, GROUND_HEIGHT))
    stripe_w = 24
    for i in range(-1, SCREEN_WIDTH // stripe_w + 2):
        x = i * stripe_w - (offset % stripe_w)
        pygame.draw.line(surface, GROUND_DARK, (x, ground_y), (x + stripe_w // 2, ground_y + GROUND_HEIGHT), 2)
    pygame.draw.line(surface, GROUND_DARK, (0, ground_y), (SCREEN_WIDTH, ground_y), 3)


def draw_text(surface, text, size, x, y, color=WHITE, center=True, shadow=True):
    font = pygame.font.SysFont("Arial", size, bold=True)
    if shadow:
        shadow_surf = font.render(text, True, BLACK)
        rect = shadow_surf.get_rect()
        if center:
            rect.center = (x + 2, y + 2)
        else:
            rect.topleft = (x + 2, y + 2)
        surface.blit(shadow_surf, rect)
    text_surf = font.render(text, True, color)
    rect = text_surf.get_rect()
    if center:
        rect.center = (x, y)
    else:
        rect.topleft = (x, y)
    surface.blit(text_surf, rect)


def main():
    pygame.init()
    pygame.display.set_caption("Flappy Bird")
    screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
    clock = pygame.time.Clock()

    bird = Bird(SCREEN_WIDTH // 4, SCREEN_HEIGHT // 2)
    pipes = []
    clouds = [
        Cloud(80, 80, 1.0),
        Cloud(220, 140, 0.7),
        Cloud(340, 60, 1.2),
    ]
    score = 0
    high_score = 0
    ground_offset = 0
    spawn_timer = 0
    state = "start"

    while True:
        dt = clock.tick(FPS)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN:
                if event.key in (pygame.K_SPACE, pygame.K_UP):
                    if state == "start":
                        state = "playing"
                        bird.flap()
                    elif state == "playing":
                        bird.flap()
                    elif state == "gameover":
                        bird = Bird(SCREEN_WIDTH // 4, SCREEN_HEIGHT // 2)
                        pipes = []
                        score = 0
                        spawn_timer = 0
                        state = "start"
                if event.key == pygame.K_ESCAPE:
                    pygame.quit()
                    sys.exit()
            if event.type == pygame.MOUSEBUTTONDOWN:
                if state == "start":
                    state = "playing"
                    bird.flap()
                elif state == "playing":
                    bird.flap()
                elif state == "gameover":
                    bird = Bird(SCREEN_WIDTH // 4, SCREEN_HEIGHT // 2)
                    pipes = []
                    score = 0
                    spawn_timer = 0
                    state = "start"

        for cloud in clouds:
            cloud.update()

        if state == "playing":
            bird.update()
            ground_offset += PIPE_SPEED

            spawn_timer += dt
            if spawn_timer >= PIPE_SPAWN_INTERVAL:
                pipes.append(Pipe(SCREEN_WIDTH + 20))
                spawn_timer = 0

            for pipe in pipes:
                pipe.update()
                if not pipe.passed and pipe.x + Pipe.WIDTH < bird.x:
                    pipe.passed = True
                    score += 1

            pipes = [p for p in pipes if not p.offscreen()]

            bird_rect = bird.get_rect()
            for pipe in pipes:
                if pipe.collides_with(bird_rect):
                    state = "gameover"
                    high_score = max(high_score, score)

            if bird.y + bird.radius >= SCREEN_HEIGHT - GROUND_HEIGHT:
                bird.y = SCREEN_HEIGHT - GROUND_HEIGHT - bird.radius
                state = "gameover"
                high_score = max(high_score, score)
            if bird.y - bird.radius < 0:
                bird.y = bird.radius
                bird.velocity = 0

        elif state == "start":
            bird.y = SCREEN_HEIGHT // 2 + (pygame.time.get_ticks() % 1000 - 500) * 0.02
            ground_offset += PIPE_SPEED

        elif state == "gameover":
            if bird.y + bird.radius < SCREEN_HEIGHT - GROUND_HEIGHT:
                bird.velocity += GRAVITY
                bird.y += bird.velocity
                bird.rotation = min(bird.rotation + 5, 90)
            else:
                bird.y = SCREEN_HEIGHT - GROUND_HEIGHT - bird.radius

        screen.fill(SKY_BLUE)
        for cloud in clouds:
            cloud.draw(screen)
        for pipe in pipes:
            pipe.draw(screen)
        draw_ground(screen, ground_offset)
        bird.draw(screen)

        if state == "start":
            draw_text(screen, "Flappy Bird", 48, SCREEN_WIDTH // 2, 140)
            draw_text(screen, "Press SPACE or click to flap", 20, SCREEN_WIDTH // 2, 220)
            draw_text(screen, "Avoid the pipes!", 18, SCREEN_WIDTH // 2, 250)
        elif state == "playing":
            draw_text(screen, str(score), 56, SCREEN_WIDTH // 2, 70)
        elif state == "gameover":
            draw_text(screen, "Game Over", 48, SCREEN_WIDTH // 2, 180)
            draw_text(screen, f"Score: {score}", 28, SCREEN_WIDTH // 2, 240)
            draw_text(screen, f"Best: {high_score}", 24, SCREEN_WIDTH // 2, 275)
            draw_text(screen, "Press SPACE to restart", 20, SCREEN_WIDTH // 2, 330)

        pygame.display.flip()


if __name__ == "__main__":
    main()
