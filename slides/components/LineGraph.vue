<script setup lang="ts">
import { onMounted, useTemplateRef } from "vue";
import Chart from "chart.js/auto";

const canvasElement = useTemplateRef("canvasElement");

const js = {
  label: "JavaScript",
  borderDash: [],
  data: [1.4, 2.4, 9.9, 37],
  color: `hsl(40deg 90% 60%)`,
};

const webgl = {
  label: "WebGL",
  borderDash: [2, 6],
  data: [0.2, 0.4, 1.2, 2.6],
  color: `hsl(200deg 80% 45%)`,
};

const datasets = [js, webgl];

onMounted(() => {
  new Chart(canvasElement.value!, {
    type: "line",
    data: {
      labels: ["100", "200", "500", "1000"],
      datasets: datasets.map((dataset) => ({
        borderDash: dataset.borderDash,
        borderJoinStyle: "round",
        borderCapStyle: "round",
        label: dataset.label,
        borderColor: dataset.color,
        pointBorderColor: "#333",
        pointBackgroundColor: dataset.color,
        pointBorderWidth: 2,
        pointRadius: 4,
        borderWidth: 4,
        data: dataset.data,
      })),
    },
    options: {
      responsive: false,
      elements: {
        line: {
          cubicInterpolationMode: "monotone",
        },
      },
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#333",
            boxHeight: 16,
            font: {
              size: 24,
            },
          },
        },
      },
      scales: {
        y: {
          title: {
            text: "Durée du calcul",
            display: true,
            color: "#111",
            font: {
              size: 24,
            },
          },
          grid: {
            drawTicks: false,
            color: "rgba(0, 0, 0, 0)",
          },
          ticks: {
            color: "#333",
            padding: 16,
            font: {
              size: 20,
            },
            callback: (value) => `${value} ms`,
          },
        },
        x: {
          title: {
            text: "Nombre d'individus",
            display: true,
            color: "#111",
            font: {
              size: 24,
            },
          },
          grid: {
            drawTicks: false,
            color: "rgba(0, 0, 0, 0.2)",
          },
          ticks: {
            color: "#333",
            padding: 16,
            font: {
              size: 20,
            },
          },
        },
      },
    },
  });
});
</script>

<template>
  <canvas ref="canvasElement" width="700" height="400" mx-auto />
</template>
