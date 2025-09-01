import cv2
import numpy as np

# 이미지 읽기 (예: "input.jpg")
img = cv2.imread("input4.jpg")

# 그레이스케일로 변환
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
cv2.imwrite(f"output_gray.jpg", gray)

# 가우시안 블러 (노이즈 제거)
blur = cv2.GaussianBlur(img, (5, 5), 1.4)
cv2.imwrite(f"output_blur.jpg", blur)

edges = cv2.Canny(blur, 100, 200)
cv2.imwrite(f"output_i_100_j_200.jpg", edges)

dots = np.zeros_like(edges)

# step 값으로 점 간격 조절 (작을수록 촘촘)
step = 4
dot_count = 0

for y in range(0, edges.shape[0], step):
    for x in range(0, edges.shape[1], step):
        if edges[y, x] != 0:  # edge가 있으면
            cv2.circle(dots, (x, y), 1, 255, -1)  # 점 찍기 (반지름=1)
            dot_count += 1

cv2.imwrite(f"output_count_{dot_count}.jpg", dots)
